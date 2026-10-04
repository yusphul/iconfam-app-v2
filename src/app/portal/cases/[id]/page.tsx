"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type {
  Case,
  CaseRecommendation,
  Milestone,
  Report,
  MediaItem,
  Payment,
  DocumentRow,
} from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import { statusStyle, LABEL_CHIP } from "@/lib/statusStyles";
import { timeAgo } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import BackLink from "@/components/BackLink";
import MessageThread from "@/components/MessageThread";
import CollapsibleSection, { Chevron } from "@/components/CollapsibleSection";

interface MediaView {
  path: string;
  url: string;
  type: string;
}

export default function ClientCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [caseRow, setCaseRow] = useState<Case | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [mediaByReport, setMediaByReport] = useState<Record<string, MediaView[]>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState<CaseRecommendation | null>(null);
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: c } = await supabase.from("cases").select("*").eq("id", id).single();
    setCaseRow(c as Case);

    const { data: ms } = await supabase
      .from("milestones")
      .select("*")
      .eq("case_id", id)
      .order("sequence_order");
    const milestoneList = (ms as Milestone[]) ?? [];
    setMilestones(milestoneList);
    // Steps with a problem start unfolded so nothing important hides; the rest
    // start folded so a long case is easy to scan.
    setOpenSteps(new Set(milestoneList.filter((m) => m.status === "issue_found").map((m) => m.id)));

    if (milestoneList.length > 0) {
      // The database only returns reports an admin has approved AND shared
      // with the client — anything still pending/rejected never reaches here.
      const { data: rp } = await supabase
        .from("reports")
        .select("*")
        .in(
          "milestone_id",
          milestoneList.map((m) => m.id)
        )
        .order("created_at", { ascending: false });
      const reportList = (rp as Report[]) ?? [];
      setReports(reportList);

      const mediaMap: Record<string, MediaView[]> = {};
      await Promise.all(
        reportList.map(async (report) => {
          const { data: mediaRows } = await supabase
            .from("media")
            .select("*")
            .eq("report_id", report.id);
          const rows = (mediaRows as MediaItem[]) ?? [];
          if (rows.length === 0) return;
          const { data: signed } = await supabase.storage
            .from("iconfam-media")
            .createSignedUrls(
              rows.map((m) => m.storage_path),
              3600
            );
          mediaMap[report.id] = rows.flatMap((row) => {
            const hit = (signed ?? []).find((s) => s.path === row.storage_path);
            return hit?.signedUrl
              ? [{ path: row.storage_path, url: hit.signedUrl, type: row.media_type }]
              : [];
          });
        })
      );
      setMediaByReport(mediaMap);
    }

    const { data: pay } = await supabase.from("payments").select("*").eq("case_id", id);
    setPayments((pay as Payment[]) ?? []);

    // Same gate for documents: only approved + shared-with-client rows come back.
    const { data: docs } = await supabase.from("documents").select("*").eq("case_id", id);
    const docList = (docs as DocumentRow[]) ?? [];
    setDocuments(docList);
    const docUrlMap: Record<string, string> = {};
    await Promise.all(
      docList.map(async (doc) => {
        const { data: signed } = await supabase.storage
          .from("iconfam-documents")
          .createSignedUrl(doc.storage_path, 3600);
        if (signed?.signedUrl) docUrlMap[doc.id] = signed.signedUrl;
      })
    );
    setDocumentUrls(docUrlMap);

    // iConfam's recommendation. The database only returns it once an admin
    // has published it, so a draft is simply absent here.
    const { data: rec } = await supabase
      .from("case_recommendations")
      .select("*")
      .eq("case_id", id)
      .maybeSingle();
    setRecommendation((rec as CaseRecommendation | null) ?? null);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const reportsByMilestone = useMemo(() => {
    const grouped: Record<string, Report[]> = {};
    for (const r of reports) (grouped[r.milestone_id] ??= []).push(r);
    return grouped;
  }, [reports]);

  function toggleStep(stepId: string) {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }

  async function downloadPdf() {
    if (!caseRow) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const { buildCaseReportPdf, caseReportFilename, loadPdfImage } = await import(
        "@/lib/caseReportPdf"
      );

      // Photos: up to 4 per report, re-signed now so a page left open for a
      // while doesn't hand the PDF expired links. Videos stay on the portal.
      const MAX_PER_REPORT = 4;
      const wanted = reports.flatMap((r) =>
        (mediaByReport[r.id] ?? [])
          .filter((m) => m.type !== "video")
          .slice(0, MAX_PER_REPORT)
          .map((m) => ({ reportId: r.id, path: m.path }))
      );
      const urlByPath = new Map<string, string>();
      if (wanted.length > 0) {
        const { data: signed } = await supabase.storage
          .from("iconfam-media")
          .createSignedUrls(
            wanted.map((w) => w.path),
            600
          );
        (signed ?? []).forEach((s) => {
          if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
        });
      }
      const loaded = await Promise.all(
        wanted.map(async (w) => {
          const url = urlByPath.get(w.path);
          return { reportId: w.reportId, image: url ? await loadPdfImage(url) : null };
        })
      );
      const images: Record<string, NonNullable<(typeof loaded)[number]["image"]>[]> = {};
      for (const { reportId, image } of loaded) {
        if (image) (images[reportId] ??= []).push(image);
      }
      const omittedMedia: Record<string, number> = {};
      for (const r of reports) {
        const total = (mediaByReport[r.id] ?? []).length;
        const missing = total - (images[r.id]?.length ?? 0);
        if (missing > 0) omittedMedia[r.id] = missing;
      }

      const pdf = buildCaseReportPdf({
        caseRow,
        clientName: profile?.full_name ?? "",
        milestones,
        reports,
        documents,
        recommendation,
        images,
        omittedMedia,
      });
      pdf.save(caseReportFilename(caseRow.id));
    } catch (e) {
      console.error("PDF generation failed", e);
      setPdfError("Couldn't create the PDF just now. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!caseRow) {
    return (
      <div>
        <BackLink href="/portal">My cases</BackLink>
        <p className="text-sm text-neutral-500">
          We couldn&apos;t find that case, or it isn&apos;t linked to your account.
        </p>
      </div>
    );
  }

  const doneCount = milestones.filter((m) => m.status === "confirmed").length;
  const allOpen = milestones.length > 0 && milestones.every((m) => openSteps.has(m.id));

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/portal">My cases</BackLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-navy">{caseRow.title}</h1>
            <p className="text-sm text-neutral-500">
              {CASE_TYPE_LABELS[caseRow.case_type]}
              {caseRow.location_description ? ` · ${caseRow.location_description}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge kind="case" value={caseRow.status} />
            <span className="text-xs text-neutral-400">Updated {timeAgo(caseRow.updated_at)}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={pdfBusy}
            className="inline-flex items-center gap-2 rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {pdfBusy ? "Preparing PDF…" : "Download report (PDF)"}
          </button>
          <span className="text-xs text-neutral-400">
            A printable copy of everything on this page.
          </span>
        </div>
        {pdfError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {pdfError}
          </p>
        )}
      </div>

      {/* iConfam's recommendation / summary — shown on every case. */}
      <RecommendationCard recommendation={recommendation} />

      {/* Overall progress: one segment per step, coloured by its status. */}
      <Section title="Progress">
        {milestones.length > 0 ? (
          <>
            <div className="flex gap-1" aria-hidden="true">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  title={m.name}
                  className={`h-2 flex-1 rounded-full ${statusStyle("milestone", m.status).bar}`}
                />
              ))}
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              {doneCount} of {milestones.length} step{milestones.length === 1 ? "" : "s"} complete
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-400">Steps will appear here once your case is scoped.</p>
        )}
      </Section>

      {/* Each step with ITS OWN reports underneath. The whole section folds
          away, and so does each step. */}
      <CollapsibleSection
        title="Steps & reports"
        summary={milestones.length ? `${milestones.length} step${milestones.length === 1 ? "" : "s"}` : undefined}
        actions={
          milestones.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                setOpenSteps(allOpen ? new Set() : new Set(milestones.map((m) => m.id)))
              }
              className="shrink-0 text-xs font-medium text-stamp hover:underline"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          ) : undefined
        }
      >
        <ol className="space-y-3">
          {milestones.map((m, i) => {
            const stepReports = reportsByMilestone[m.id] ?? [];
            const open = openSteps.has(m.id);
            return (
              <li
                key={m.id}
                className={`rounded-lg border border-l-4 border-line bg-white ${statusStyle("milestone", m.status).accent}`}
              >
                <button
                  type="button"
                  onClick={() => toggleStep(m.id)}
                  aria-expanded={open}
                  aria-label={`${m.name}, ${stepReports.length} report${stepReports.length === 1 ? "" : "s"}`}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Chevron open={open} />
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-semibold text-neutral-500 ring-1 ring-line">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-navy">{m.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                        {m.owner_label && <span className={LABEL_CHIP}>{m.owner_label}</span>}
                        {m.due_date && <span>Due {new Date(m.due_date).toLocaleDateString()}</span>}
                        <span>
                          {stepReports.length} report{stepReports.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </span>
                  </div>
                  <StatusBadge kind="milestone" value={m.status} />
                </button>

                {open && (
                  <div className="space-y-3 border-t border-line bg-paper/60 px-4 py-3">
                    {stepReports.map((r) => (
                      <div key={r.id} className="rounded border border-line bg-white p-3 text-sm">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <StatusBadge kind="report" value={r.status_flag} />
                          <span className="text-xs text-neutral-400">
                            {r.author_label ? `${r.author_label} · ` : ""}
                            {new Date(r.visit_time).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-neutral-700">{r.findings_summary}</p>
                        {mediaByReport[r.id]?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {mediaByReport[r.id].map((m2, idx) =>
                              m2.type === "video" ? (
                                <a
                                  key={idx}
                                  href={m2.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex h-20 items-center rounded border border-line px-3 text-xs font-medium text-stamp hover:underline"
                                >
                                  ▶ Video evidence
                                </a>
                              ) : (
                                <a key={idx} href={m2.url} target="_blank" rel="noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={m2.url}
                                    alt="Field evidence"
                                    className="h-20 w-20 rounded border border-line object-cover"
                                  />
                                </a>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {stepReports.length === 0 && (
                      <p className="text-sm text-neutral-400">
                        {m.status === "confirmed"
                          ? "Completed — no separate report was published for this step."
                          : "No report yet for this step — your verification team is on it."}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {milestones.length === 0 && (
          <p className="text-sm text-neutral-400">Nothing to show yet.</p>
        )}
      </CollapsibleSection>

      {/* Documents */}
      <Section title="Documents">
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="rounded border border-line bg-paper px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-medium">{doc.doc_type}</span>
                  {doc.author_label && (
                    <span className="ml-2 text-xs text-neutral-400">from {doc.author_label}</span>
                  )}
                </span>
                {documentUrls[doc.id] && (
                  <a
                    href={documentUrls[doc.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-stamp hover:underline"
                  >
                    View
                  </a>
                )}
              </div>
              {doc.retention_note && (
                <p className="mt-1 text-xs text-neutral-400">{doc.retention_note}</p>
              )}
            </li>
          ))}
          {documents.length === 0 && (
            <p className="text-sm text-neutral-400">
              No documents on this case — we verify directly with the registry in
              most cases, so you&apos;re rarely asked to upload anything.
            </p>
          )}
        </ul>
      </Section>

      {/* Payments */}
      <Section title="Payments">
        <ul className="space-y-2">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border border-line bg-paper px-3 py-2 text-sm"
            >
              <div>
                <div>{p.description}</div>
                <div className="text-xs text-neutral-400">
                  {p.currency} {p.amount}
                </div>
              </div>
              <StatusBadge kind="payment" value={p.status} />
            </li>
          ))}
          {payments.length === 0 && (
            <p className="text-sm text-neutral-400">No fees on this case yet.</p>
          )}
        </ul>
      </Section>

      {/* Messages — a private conversation with the iConfam team */}
      <Section title="Messages">
        {profile && (
          <MessageThread
            caseId={id}
            threadUserId={profile.id}
            currentUserId={profile.id}
            labelFor={() => "iConfam team"}
            placeholder="Ask a question about this case…"
            emptyText="No messages yet."
          />
        )}
      </Section>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: CaseRecommendation | null }) {
  if (!recommendation) {
    return (
      <div className="rounded-lg border border-l-4 border-line border-l-slate-300 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Our recommendation
        </h2>
        <p className="text-sm text-neutral-500">
          We&apos;ll add our recommendation and a plain-language summary here once your
          verification steps are complete.
        </p>
      </div>
    );
  }
  const tone = statusStyle("verdict", recommendation.verdict);
  return (
    <div className={`rounded-lg border border-l-4 border-line bg-white p-4 ${tone.accent}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Our recommendation
        </h2>
        <StatusBadge kind="verdict" value={recommendation.verdict} className="text-sm" />
      </div>
      <p className="whitespace-pre-wrap text-sm text-neutral-800">{recommendation.summary}</p>
      {recommendation.next_steps?.trim() && (
        <div className="mt-3 rounded border border-line bg-paper px-3 py-2">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Recommended next steps
          </h3>
          <p className="whitespace-pre-wrap text-sm text-neutral-700">{recommendation.next_steps}</p>
        </div>
      )}
      <p className="mt-3 text-xs text-neutral-400">
        Published {new Date(recommendation.published_at ?? recommendation.updated_at).toLocaleDateString()} ·
        this is our independent assessment to help you decide, not legal or financial advice.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      {children}
    </div>
  );
}
