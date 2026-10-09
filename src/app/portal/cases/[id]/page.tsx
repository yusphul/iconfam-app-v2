"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type {
  Case,
  CaseRecommendation,
  Milestone,
  MilestoneStatus,
  RecommendationVerdict,
  Report,
  MediaItem,
  Payment,
  DocumentRow,
} from "@/lib/types";
import { CASE_TYPE_LABELS, VERDICT_LABELS } from "@/lib/types";
import { statusStyle, LABEL_CHIP } from "@/lib/statusStyles";
import { daysSince } from "@/lib/caseVisuals";
import Illustration from "@/components/portal/Illustration";
import StatusBadge from "@/components/StatusBadge";
import BackLink from "@/components/BackLink";
import MessageThread from "@/components/MessageThread";
import CollapsibleSection, { Chevron } from "@/components/CollapsibleSection";
import Disclosure from "@/components/portal/Disclosure";
import Lightbox, { type LightboxImage } from "@/components/portal/Lightbox";
import ProgressRing from "@/components/portal/ProgressRing";
import Skeleton from "@/components/portal/Skeleton";
import PaymentPanel, { depositState, type PaymentInstructions } from "@/components/journey/PaymentPanel";
import {
  AlertIcon,
  BangIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  FileIcon,
  HelpIcon,
  PinIcon,
  PlayIcon,
  ShieldCheckIcon,
  XIcon,
} from "@/components/portal/icons";

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
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [openPay, setOpenPay] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<CaseRecommendation | null>(null);
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ images: LightboxImage[]; index: number } | null>(null);

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

    const { data: pay } = await supabase
      .from("payments")
      .select("*")
      .eq("case_id", id)
      .order("created_at");
    setPayments((pay as Payment[]) ?? []);

    // Bank details and the naira rate, only needed when something is due.
    const { data: ins } = await supabase.rpc("payment_instructions");
    const insRow = Array.isArray(ins) ? ins[0] : ins;
    setInstructions(
      insRow
        ? {
            bank_usd: insRow.bank_usd,
            bank_ngn: insRow.bank_ngn,
            usd_to_ngn_rate: insRow.usd_to_ngn_rate ? Number(insRow.usd_to_ngn_rate) : null,
          }
        : null
    );

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

  function openViewer(reportId: string, stepName: string, startUrl: string) {
    const photos = (mediaByReport[reportId] ?? []).filter((m) => m.type !== "video");
    const images = photos.map((m, i) => ({
      url: m.url,
      alt: `Evidence photo ${i + 1} of ${photos.length} for ${stepName}`,
    }));
    setViewer({ images, index: Math.max(0, photos.findIndex((m) => m.url === startUrl)) });
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

  if (loading) return <CaseSkeleton />;
  if (!caseRow) {
    return (
      <div>
        <BackLink href="/portal">My cases</BackLink>
        <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
          <p className="text-neutral-600">
            We couldn&apos;t find that case, or it isn&apos;t linked to your account.
          </p>
        </div>
      </div>
    );
  }

  const done = milestones.filter((m) => m.status === "confirmed").length;
  const issues = milestones.filter((m) => m.status === "issue_found").length;
  const allOpen = milestones.length > 0 && milestones.every((m) => openSteps.has(m.id));
  const opened = daysSince(caseRow.created_at);

  return (
    <div className="space-y-8">
      {/* The one bold moment: the case, seen from the ground. */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-footerBg text-white shadow-lg">
        <Illustration kind={caseRow.case_type} calm className="absolute inset-0 -z-20 h-full w-full opacity-60 sm:opacity-100" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-footerBg/90 via-footerBg/30 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-footerBg/60 via-footerBg/10 to-transparent" />

        <div className="px-5 pt-5 sm:px-9 sm:pt-7">
          <div className="flex items-start justify-between gap-3">
            <BackLink href="/portal" tone="light">
              My cases
            </BackLink>
            <StatusBadge kind="case" value={caseRow.status} variant="glass" />
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-6 sm:mt-14">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-white/80">
                {CASE_TYPE_LABELS[caseRow.case_type]}
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                {caseRow.title}
              </h1>
              {caseRow.location_description && (
                <p className="mt-2 flex items-center gap-1.5 text-white/85">
                  <PinIcon size={15} className="shrink-0" />
                  {caseRow.location_description}
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={pdfBusy}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy shadow-sm transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70"
                >
                  <DownloadIcon size={16} />
                  {pdfBusy ? "Preparing PDF…" : "Download report (PDF)"}
                </button>
                <span className="text-xs text-white/70">A printable copy of everything here.</span>
              </div>
              {pdfError && (
                <p role="alert" className="mt-2 text-sm text-red-200">
                  {pdfError}
                </p>
              )}
            </div>

            {milestones.length > 0 && (
              <div className="rounded-full bg-footerBg/80 shadow-lg">
                <ProgressRing value={done} max={milestones.length} size={124} stroke={10}>
                  <span className="font-display text-3xl font-bold leading-none tabular-nums">
                    {done}
                  </span>
                  <span className="mt-1 text-xs text-white/75">of {milestones.length} verified</span>
                </ProgressRing>
              </div>
            )}
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-px border-t border-white/15 bg-white/15 sm:grid-cols-4">
          <HeroStat
            label="Steps verified"
            value={milestones.length ? `${done} of ${milestones.length}` : "None yet"}
          />
          <HeroStat label="Reports received" value={String(reports.length)} />
          <HeroStat
            label="Issues flagged"
            value={String(issues)}
            alert={issues > 0}
          />
          <HeroStat
            label="Case opened"
            value={opened === 0 ? "Today" : `${opened} day${opened === 1 ? "" : "s"} ago`}
          />
        </dl>
      </section>

      {caseRow.deposit_required && (
        <DepositBanner
          state={depositState(payments)}
          payment={payments.find((p) => p.kind === "deposit")}
          onPay={() => {
            const dep = payments.find((p) => p.kind === "deposit");
            if (dep) setOpenPay(dep.id);
            document.getElementById("payments")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      <RecommendationPanel recommendation={recommendation} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        {/* Verification journey: each step with ITS OWN reports. The whole
            section folds away, and so does each step. */}
        <CollapsibleSection
          title="Verification journey"
          summary={
            milestones.length
              ? `${milestones.length} step${milestones.length === 1 ? "" : "s"}`
              : undefined
          }
          actions={
            milestones.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  setOpenSteps(allOpen ? new Set() : new Set(milestones.map((m) => m.id)))
                }
                className="shrink-0 rounded text-sm font-medium text-stamp hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            ) : undefined
          }
        >
          {milestones.length === 0 ? (
            <p className="text-neutral-500">
              Your verification steps will appear here once the scope of work is agreed.
            </p>
          ) : (
            <ol>
              {milestones.map((m, i) => {
                const stepReports = reportsByMilestone[m.id] ?? [];
                const open = openSteps.has(m.id);
                const last = i === milestones.length - 1;
                return (
                  <li key={m.id} className={`relative pl-12 ${last ? "" : "pb-4"}`}>
                    {!last && (
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-0 left-[15px] top-9 w-0.5 rounded-full ${
                          m.status === "confirmed" ? "bg-emerald-300" : "bg-slate-200"
                        }`}
                      />
                    )}
                    <StepNode status={m.status} />
                    <div
                      className={`overflow-hidden rounded-xl border bg-white transition-shadow ${
                        open ? "border-slate-300 shadow-sm" : "border-line"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleStep(m.id)}
                        aria-expanded={open}
                        aria-label={`${m.name}, ${stepReports.length} report${stepReports.length === 1 ? "" : "s"}`}
                        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stamp"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-navy">{m.name}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                            {m.owner_label && <span className={LABEL_CHIP}>{m.owner_label}</span>}
                            {m.due_date && (
                              <span>Due {new Date(m.due_date).toLocaleDateString()}</span>
                            )}
                            <span>
                              {stepReports.length} report{stepReports.length === 1 ? "" : "s"}
                            </span>
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <StatusBadge kind="milestone" value={m.status} />
                          <Chevron open={open} />
                        </span>
                      </button>

                      <Disclosure open={open}>
                        <div className="space-y-3 border-t border-line bg-paper/70 p-4">
                          {stepReports.map((r) => (
                            <ReportCard
                              key={r.id}
                              report={r}
                              media={mediaByReport[r.id] ?? []}
                              onOpen={(url) => openViewer(r.id, m.name, url)}
                            />
                          ))}
                          {stepReports.length === 0 && (
                            <p className="text-sm text-neutral-500">
                              {m.status === "confirmed"
                                ? "Completed — no separate report was published for this step."
                                : "No report yet for this step — your verification team is on it."}
                            </p>
                          )}
                        </div>
                      </Disclosure>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CollapsibleSection>

        <aside className="space-y-6">
          <SideCard title="Payments" id="payments">
            {caseRow.quote_lines && caseRow.quote_lines.length > 0 && (
              <div className="mb-4 rounded-lg bg-paper p-3 text-sm">
                <p className="mb-1.5 font-semibold text-navy">Your quote</p>
                <table className="w-full">
                  <tbody>
                    {caseRow.quote_lines.map((l) => (
                      <tr key={l.label}>
                        <td className="py-0.5 pr-3 text-neutral-700">{l.label}</td>
                        <td className="py-0.5 text-right tabular-nums">{caseRow.quote_currency} {l.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-line font-semibold text-navy">
                      <td className="pt-1.5 pr-3">Total</td>
                      <td className="pt-1.5 text-right tabular-nums">{caseRow.quote_currency} {Number(caseRow.quote_total).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <PaymentPanel
              payments={payments}
              instructions={instructions}
              openId={openPay}
              onOpen={setOpenPay}
              onChanged={() => {
                setOpenPay(null);
                load();
              }}
            />
          </SideCard>

          <SideCard title="Documents">
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-line">
                    <FileIcon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy">{doc.doc_type}</p>
                    <p className="truncate text-xs text-neutral-400">
                      {doc.author_label ? `From ${doc.author_label}` : "Shared by iConfam"}
                      {doc.retention_note ? ` · ${doc.retention_note}` : ""}
                    </p>
                  </div>
                  {documentUrls[doc.id] && (
                    <a
                      href={documentUrls[doc.id]}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded text-sm font-medium text-stamp hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
                    >
                      View
                    </a>
                  )}
                </li>
              ))}
              {documents.length === 0 && (
                <p className="text-sm leading-relaxed text-neutral-500">
                  No documents on this case. We verify directly with the registry in most
                  cases, so you&apos;re rarely asked to upload anything.
                </p>
              )}
            </ul>
          </SideCard>

          <SideCard title="Messages">
            <p className="mb-3 text-xs leading-relaxed text-neutral-400">
              A private line to your iConfam team. Ask anything about this case.
            </p>
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
          </SideCard>
        </aside>
      </div>

      {viewer && (
        <Lightbox
          images={viewer.images}
          index={viewer.index}
          onIndex={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

function HeroStat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-footerBg/60 px-5 py-3.5 backdrop-blur-md sm:px-7">
      <dt className="text-xs text-white/70">{label}</dt>
      <dd
        className={`mt-0.5 font-display text-lg font-semibold tabular-nums ${
          alert ? "text-red-300" : "text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

const VERDICT_ICON: Record<RecommendationVerdict, typeof ShieldCheckIcon> = {
  proceed: ShieldCheckIcon,
  proceed_with_caution: AlertIcon,
  do_not_proceed: XIcon,
  inconclusive: HelpIcon,
};

function RecommendationPanel({ recommendation }: { recommendation: CaseRecommendation | null }) {
  if (!recommendation) {
    return (
      <section className="flex items-start gap-4 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <ClockIcon size={22} />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">Our recommendation</h2>
          <p className="mt-1 max-w-prose leading-relaxed text-neutral-600">
            We&apos;ll add our recommendation and a plain-language summary here once your
            verification steps are complete.
          </p>
        </div>
      </section>
    );
  }
  const tone = statusStyle("verdict", recommendation.verdict);
  const Icon = VERDICT_ICON[recommendation.verdict];
  return (
    <section
      className={`rounded-2xl border bg-gradient-to-br to-white p-6 shadow-sm sm:p-8 ${tone.tint} ${tone.border}`}
    >
      <div className="flex items-start gap-4 sm:gap-5">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 sm:h-14 sm:w-14 ${tone.text}`}
        >
          <Icon size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-neutral-500">Our recommendation</h2>
          <p
            className={`font-display text-2xl font-bold tracking-tight sm:text-3xl ${tone.text}`}
          >
            {VERDICT_LABELS[recommendation.verdict]}
          </p>
          <p className="mt-3 max-w-prose whitespace-pre-wrap leading-relaxed text-neutral-800">
            {recommendation.summary}
          </p>
          {recommendation.next_steps?.trim() && (
            <div className="mt-5 max-w-prose rounded-xl border border-black/5 bg-white/80 p-4">
              <h3 className="text-sm font-semibold text-navy">What we suggest you do next</h3>
              <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-neutral-700">
                {recommendation.next_steps}
              </p>
            </div>
          )}
          <p className="mt-5 max-w-prose text-xs leading-relaxed text-neutral-500">
            Published{" "}
            {new Date(recommendation.published_at ?? recommendation.updated_at).toLocaleDateString()}
            . This is our independent assessment to help you decide. It is not legal or financial
            advice.
          </p>
        </div>
      </div>
    </section>
  );
}

function StepNode({ status }: { status: MilestoneStatus }) {
  const base = "absolute left-0 top-1.5 flex h-8 w-8 items-center justify-center rounded-full";
  if (status === "confirmed") {
    return (
      <span className={`${base} bg-emerald-500 text-white shadow-sm`} aria-hidden="true">
        <CheckIcon size={16} />
      </span>
    );
  }
  if (status === "issue_found") {
    return (
      <span className={`${base} bg-red-500 text-white shadow-sm`} aria-hidden="true">
        <BangIcon size={18} />
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className={`${base} bg-white ring-2 ring-blue-500`} aria-hidden="true">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60 motion-reduce:animate-none" />
          <span className="relative h-3 w-3 rounded-full bg-blue-500" />
        </span>
      </span>
    );
  }
  return (
    <span className={`${base} bg-white ring-2 ring-slate-300`} aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-slate-300" />
    </span>
  );
}

function ReportCard({
  report,
  media,
  onOpen,
}: {
  report: Report;
  media: MediaView[];
  onOpen: (url: string) => void;
}) {
  return (
    <article className="rounded-xl border border-line bg-white p-4 text-sm shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <StatusBadge kind="report" value={report.status_flag} />
        <span className="text-xs text-neutral-400">
          {report.author_label ? `${report.author_label} · ` : ""}
          {new Date(report.visit_time).toLocaleDateString()}
        </span>
      </div>
      <p className="whitespace-pre-wrap leading-relaxed text-neutral-700">
        {report.findings_summary}
      </p>
      {media.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((m, idx) => (
            <li key={idx}>
              {m.type === "video" ? (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-footerBg text-xs font-medium text-white transition hover:bg-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
                >
                  <PlayIcon size={22} />
                  Video
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(m.url)}
                  aria-label="View photo full screen"
                  className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt="Field evidence"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function DepositBanner({
  state,
  payment,
  onPay,
}: {
  state: "none" | "due" | "reported" | "paid";
  payment?: Payment;
  onPay: () => void;
}) {
  if (state === "none") return null;
  if (state === "paid") {
    return (
      <section className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden="true">
          <CheckIcon size={20} />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">Deposit received. Thank you.</h2>
          <p className="mt-0.5 text-neutral-700">We&apos;re assigning your team and your steps will appear below.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white" aria-hidden="true">
          <ClockIcon size={20} />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">
            {state === "reported" ? "We're confirming your deposit" : "Pay your deposit to start"}
          </h2>
          <p className="mt-0.5 max-w-prose text-neutral-700">
            {state === "reported"
              ? "We'll begin as soon as your transfer is confirmed, usually within one business day."
              : `We begin work as soon as your initial deposit${payment ? ` of ${payment.currency} ${Number(payment.amount).toLocaleString()}` : ""} is received. Nothing else is charged until then.`}
          </p>
        </div>
      </div>
      {state === "due" && (
        <button
          type="button"
          onClick={onPay}
          className="rounded-full bg-stamp px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stampDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
        >
          Pay deposit
        </button>
      )}
    </section>
  );
}

function SideCard({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-display text-lg font-semibold text-navy">{title}</h2>
      {children}
    </section>
  );
}

function CaseSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading case">
      <Skeleton className="h-[26rem] w-full rounded-3xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Skeleton className="h-96 rounded-2xl" />
        <div className="space-y-6">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
