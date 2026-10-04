"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { Case, Milestone, Report, MediaItem, Payment, DocumentRow } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import { statusStyle, LABEL_CHIP } from "@/lib/statusStyles";
import { timeAgo } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import BackLink from "@/components/BackLink";
import MessageThread from "@/components/MessageThread";

export default function ClientCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [caseRow, setCaseRow] = useState<Case | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [mediaByReport, setMediaByReport] = useState<Record<string, string[]>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: c } = await supabase.from("cases").select("*").eq("id", id).single();
    setCaseRow(c as Case);

    const { data: ms } = await supabase
      .from("milestones")
      .select("*")
      .eq("case_id", id)
      .order("sequence_order");
    setMilestones((ms as Milestone[]) ?? []);

    if (ms && ms.length > 0) {
      // The database only returns reports an admin has approved AND shared
      // with the client — anything still pending/rejected never reaches here.
      const { data: rp } = await supabase
        .from("reports")
        .select("*")
        .in(
          "milestone_id",
          ms.map((m) => m.id)
        )
        .order("created_at", { ascending: false });
      const reportList = (rp as Report[]) ?? [];
      setReports(reportList);

      const mediaMap: Record<string, string[]> = {};
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
          mediaMap[report.id] = (signed ?? [])
            .map((s) => s.signedUrl)
            .filter((u): u is string => Boolean(u));
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
          <div className="flex flex-col items-end gap-1">
            <StatusBadge kind="case" value={caseRow.status} />
            <span className="text-xs text-neutral-400">Updated {timeAgo(caseRow.updated_at)}</span>
          </div>
        </div>
      </div>

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

      {/* Each step with ITS OWN reports underneath, instead of one flat feed. */}
      <Section title="Steps & reports">
        <ol className="space-y-4">
          {milestones.map((m, i) => {
            const stepReports = reportsByMilestone[m.id] ?? [];
            return (
              <li
                key={m.id}
                className={`rounded-lg border border-l-4 border-line bg-white ${statusStyle("milestone", m.status).accent}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-semibold text-neutral-500 ring-1 ring-line">
                        {i + 1}
                      </span>
                      <span className="font-medium text-navy">{m.name}</span>
                    </div>
                    {(m.owner_label || m.due_date) && (
                      <div className="ml-8 mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                        {m.owner_label && <span className={LABEL_CHIP}>{m.owner_label}</span>}
                        {m.due_date && <span>Due {new Date(m.due_date).toLocaleDateString()}</span>}
                      </div>
                    )}
                  </div>
                  <StatusBadge kind="milestone" value={m.status} />
                </div>

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
                      <p className="text-neutral-700">{r.findings_summary}</p>
                      {mediaByReport[r.id]?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {mediaByReport[r.id].map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt="Field evidence"
                                className="h-20 w-20 rounded border border-line object-cover"
                              />
                            </a>
                          ))}
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
              </li>
            );
          })}
        </ol>
        {milestones.length === 0 && (
          <p className="text-sm text-neutral-400">Nothing to show yet.</p>
        )}
      </Section>

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
