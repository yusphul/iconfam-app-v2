"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type {
  Case,
  CaseProfessional,
  Milestone,
  MilestoneStatus,
  Report,
  MediaItem,
  Payment,
  AppUser,
  CaseStatus,
  DocumentRow,
  ProfessionalSpecialty,
} from "@/lib/types";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  MILESTONE_STATUS_LABELS,
  SPECIALTY_LABELS,
  roleLabel,
} from "@/lib/types";
import { statusStyle, LABEL_CHIP } from "@/lib/statusStyles";
import { detectContactInfo } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import BackLink from "@/components/BackLink";
import ReviewControls from "@/components/ReviewControls";
import MessageThread from "@/components/MessageThread";

export default function AdminCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [caseRow, setCaseRow] = useState<Case | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [mediaByReport, setMediaByReport] = useState<Record<string, string[]>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [usersById, setUsersById] = useState<Record<string, AppUser>>({});
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [professionals, setProfessionals] = useState<AppUser[]>([]);
  const [assigned, setAssigned] = useState<CaseProfessional[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // form state
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [newPaymentDesc, setNewPaymentDesc] = useState("");
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [pickSpecialty, setPickSpecialty] = useState<ProfessionalSpecialty | "">("");
  const [pickProfessional, setPickProfessional] = useState("");
  const [threadWith, setThreadWith] = useState<string>("");
  const notesSeeded = useRef(false);

  const load = useCallback(async () => {
    const [{ data: c }, { data: allUsers }, { data: cp }, { data: noteRow }] = await Promise.all([
      supabase.from("cases").select("*").eq("id", id).single(),
      supabase.from("users").select("*"),
      supabase.from("case_professionals").select("*").eq("case_id", id).order("assigned_at"),
      supabase.from("case_internal_notes").select("notes").eq("case_id", id).maybeSingle(),
    ]);
    setCaseRow(c as Case);
    setAssigned((cp as CaseProfessional[]) ?? []);
    // Seed the textarea once per page load, so a reload triggered by another
    // action never overwrites an edit that hasn't blurred/saved yet.
    if (!notesSeeded.current) {
      notesSeeded.current = true;
      setNotes((noteRow as { notes: string } | null)?.notes ?? "");
    }

    const users = (allUsers as AppUser[] | null) ?? [];
    const usersMap: Record<string, AppUser> = {};
    users.forEach((u) => (usersMap[u.id] = u));
    setUsersById(usersMap);
    setAgents(users.filter((u) => u.role === "agent" && u.active));
    setProfessionals(users.filter((u) => u.role === "professional" && u.active));

    const { data: ms } = await supabase
      .from("milestones")
      .select("*")
      .eq("case_id", id)
      .order("sequence_order");
    setMilestones((ms as Milestone[]) ?? []);

    if (ms && ms.length > 0) {
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
    } else {
      setReports([]);
    }

    const { data: pay } = await supabase
      .from("payments")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false });
    setPayments((pay as Payment[]) ?? []);

    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false });
    const docList = (docs as DocumentRow[]) ?? [];
    setDocuments(docList);
    const urlMap: Record<string, string> = {};
    await Promise.all(
      docList.map(async (doc) => {
        const { data: signed } = await supabase.storage
          .from("iconfam-documents")
          .createSignedUrl(doc.storage_path, 3600);
        if (signed?.signedUrl) urlMap[doc.id] = signed.signedUrl;
      })
    );
    setDocumentUrls(urlMap);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(promise: PromiseLike<{ error: { message: string } | null }>) {
    setActionError(null);
    const { error } = await promise;
    if (error) setActionError(error.message);
    await load();
  }

  const updateStatus = (status: CaseStatus) =>
    run(supabase.from("cases").update({ status }).eq("id", id));

  const reassignAgent = (value: string) =>
    run(supabase.from("cases").update({ assigned_agent_id: value || null }).eq("id", id));

  const addProfessional = async () => {
    if (!pickProfessional) return;
    await run(
      supabase.from("case_professionals").insert({ case_id: id, professional_id: pickProfessional })
    );
    setPickProfessional("");
    setPickSpecialty("");
  };

  const removeProfessional = (rowId: string) =>
    run(supabase.from("case_professionals").delete().eq("id", rowId));

  async function saveNotes() {
    setNotesSaved(false);
    const { error } = await supabase
      .from("case_internal_notes")
      .upsert({ case_id: id, notes }, { onConflict: "case_id" });
    if (error) setActionError(error.message);
    else setNotesSaved(true);
  }

  async function addMilestone() {
    if (!newMilestoneName.trim()) return;
    await run(
      supabase.from("milestones").insert({
        case_id: id,
        name: newMilestoneName.trim(),
        sequence_order: milestones.length + 1,
      })
    );
    setNewMilestoneName("");
  }

  const updateMilestoneStatus = (milestoneId: string, status: MilestoneStatus) =>
    run(supabase.from("milestones").update({ status }).eq("id", milestoneId));

  async function logPayment() {
    if (!newPaymentDesc.trim() || !newPaymentAmount) return;
    await run(
      supabase.from("payments").insert({
        case_id: id,
        description: newPaymentDesc.trim(),
        amount: Number(newPaymentAmount),
        status: "pending",
      })
    );
    setNewPaymentDesc("");
    setNewPaymentAmount("");
  }

  const markPaymentPaid = (paymentId: string) =>
    run(
      supabase
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", paymentId)
    );

  const reportsByMilestone = useMemo(() => {
    const grouped: Record<string, Report[]> = {};
    for (const r of reports) (grouped[r.milestone_id] ??= []).push(r);
    return grouped;
  }, [reports]);

  // Everyone the admin can hold a private conversation with on this case.
  const threads = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    if (caseRow) {
      const client = usersById[caseRow.client_id];
      list.push({ id: caseRow.client_id, label: `Client${client ? ` — ${client.full_name}` : ""}` });
      const agent = caseRow.assigned_agent_id ? usersById[caseRow.assigned_agent_id] : null;
      if (agent) list.push({ id: agent.id, label: `Field agent — ${agent.full_name}` });
    }
    for (const a of assigned) {
      const p = usersById[a.professional_id];
      if (p) list.push({ id: p.id, label: `${roleLabel(p)} — ${p.full_name}` });
    }
    return list;
  }, [caseRow, assigned, usersById]);

  const activeThread = threads.find((t) => t.id === threadWith) ?? threads[0];

  if (loading) return <p className="text-sm text-neutral-500">Loading case…</p>;
  if (!caseRow) {
    return (
      <div>
        <BackLink href="/admin/cases">All cases</BackLink>
        <p className="text-sm text-neutral-500">No case found with that ID.</p>
      </div>
    );
  }

  const client = usersById[caseRow.client_id];
  const assignedIds = new Set(assigned.map((a) => a.professional_id));
  const candidates = professionals.filter(
    (p) => !assignedIds.has(p.id) && (!pickSpecialty || p.specialty === pickSpecialty)
  );
  const pendingReports = reports.filter((r) => r.review_status === "pending").length;
  const pendingDocs = documents.filter((d) => d.review_status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/admin/cases">All cases</BackLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-navy">{caseRow.title}</h1>
            <p className="text-sm text-neutral-500">
              {CASE_TYPE_LABELS[caseRow.case_type]} · Client: {client?.full_name ?? "—"}
              {caseRow.location_description ? ` · ${caseRow.location_description}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingReports + pendingDocs > 0 && (
              <StatusBadge
                kind="review"
                value="pending"
                label={`${pendingReports + pendingDocs} awaiting your review`}
              />
            )}
            <StatusBadge kind="case" value={caseRow.status} />
          </div>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Status + assignment */}
          <Section title="Status & Assignment">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <LabeledSelect
                label="Status"
                value={caseRow.status}
                onChange={(v) => updateStatus(v as CaseStatus)}
                options={Object.entries(CASE_STATUS_LABELS)}
              />
              <LabeledSelect
                label="Field agent"
                value={caseRow.assigned_agent_id ?? ""}
                onChange={reassignAgent}
                options={[
                  ["", "Unassigned"],
                  ...agents.map((a) => [a.id, a.full_name] as [string, string]),
                ]}
              />
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Professionals on this case
              </h3>
              <ul className="mb-3 space-y-2">
                {assigned.map((a) => {
                  const p = usersById[a.professional_id];
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded border border-line bg-paper px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className={LABEL_CHIP}>{p ? roleLabel(p) : "Professional"}</span>
                        {p?.full_name ?? "—"}
                      </span>
                      <button
                        onClick={() => removeProfessional(a.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
                {assigned.length === 0 && (
                  <p className="text-sm text-neutral-400">
                    No professional assigned yet. Pick a specialty, then a person.
                  </p>
                )}
              </ul>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                <LabeledSelect
                  label="Specialty"
                  value={pickSpecialty}
                  onChange={(v) => {
                    setPickSpecialty(v as ProfessionalSpecialty | "");
                    setPickProfessional("");
                  }}
                  options={[
                    ["", "Any specialty"],
                    ...Object.entries(SPECIALTY_LABELS),
                  ]}
                />
                <LabeledSelect
                  label="Professional"
                  value={pickProfessional}
                  onChange={setPickProfessional}
                  options={[
                    ["", candidates.length ? "Select…" : "No one available"],
                    ...candidates.map(
                      (p) =>
                        [
                          p.id,
                          `${p.full_name}${p.specialty ? ` (${SPECIALTY_LABELS[p.specialty]})` : ""}`,
                        ] as [string, string]
                    ),
                  ]}
                />
                <button
                  onClick={addProfessional}
                  disabled={!pickProfessional}
                  className="self-end rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                >
                  Assign
                </button>
              </div>
            </div>
          </Section>

          {/* Milestones, each with its own reports and the review controls */}
          <Section title="Milestones & reports">
            <ol className="mb-4 space-y-4">
              {milestones.map((m, i) => {
                const stepReports = reportsByMilestone[m.id] ?? [];
                return (
                  <li
                    key={m.id}
                    className={`rounded-lg border border-l-4 border-line bg-white ${statusStyle("milestone", m.status).accent}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-semibold text-neutral-500 ring-1 ring-line">
                          {i + 1}
                        </span>
                        <span className="font-medium text-navy">{m.name}</span>
                        {m.owner_label && <span className={LABEL_CHIP}>{m.owner_label}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge kind="milestone" value={m.status} />
                        <select
                          aria-label={`Status of ${m.name}`}
                          value={m.status}
                          onChange={(e) =>
                            updateMilestoneStatus(m.id, e.target.value as MilestoneStatus)
                          }
                          className="rounded border border-line bg-white px-2 py-1 text-xs"
                        >
                          {Object.entries(MILESTONE_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-line bg-paper/60 px-4 py-3">
                      {stepReports.map((r) => {
                        const warn = detectContactInfo(r.findings_summary);
                        return (
                          <div key={r.id} className="rounded border border-line bg-white p-3 text-sm">
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                              <StatusBadge kind="report" value={r.status_flag} />
                              <span className="text-xs text-neutral-400">
                                {usersById[r.submitted_by]
                                  ? `${roleLabel(usersById[r.submitted_by])} · ${usersById[r.submitted_by].full_name}`
                                  : r.author_label ?? "—"}{" "}
                                · {new Date(r.visit_time).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-neutral-700">{r.findings_summary}</p>
                            {warn.length > 0 && (
                              <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                                ⚠ Possible contact details in this text ({warn.join(", ")}). Check
                                before sharing.
                              </p>
                            )}
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
                            <ReviewControls
                              table="reports"
                              id={r.id}
                              status={r.review_status}
                              shareWithClient={r.share_with_client}
                              shareWithTeam={r.share_with_team}
                              reviewNote={r.review_note}
                              onChanged={load}
                            />
                          </div>
                        );
                      })}
                      {stepReports.length === 0 && (
                        <p className="text-sm text-neutral-400">No reports for this step yet.</p>
                      )}
                    </div>
                  </li>
                );
              })}
              {milestones.length === 0 && (
                <p className="text-sm text-neutral-400">No milestones yet.</p>
              )}
            </ol>
            <div className="flex gap-2">
              <input
                value={newMilestoneName}
                onChange={(e) => setNewMilestoneName(e.target.value)}
                placeholder="e.g. Title & registry status check"
                className="flex-1 rounded border border-line bg-paper px-3 py-2 text-sm"
              />
              <button
                onClick={addMilestone}
                className="rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Add
              </button>
            </div>
          </Section>

          {/* Messages: one private thread per participant */}
          <Section title="Messages">
            <div className="mb-3 flex flex-wrap gap-2">
              {threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThreadWith(t.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    activeThread?.id === t.id
                      ? "border-navy bg-navy text-white"
                      : "border-line bg-white text-neutral-600 hover:bg-paper"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mb-3 text-xs text-neutral-400">
              Each conversation is private to that person and the admin team. Professionals and
              the client can never see each other&apos;s messages.
            </p>
            {activeThread && profile && (
              <MessageThread
                key={activeThread.id}
                caseId={id}
                threadUserId={activeThread.id}
                currentUserId={profile.id}
                labelFor={(senderId) => {
                  const u = usersById[senderId];
                  return u ? `${u.full_name} (${roleLabel(u)})` : "—";
                }}
                placeholder="Send a message on this case…"
                emptyText="No messages in this conversation yet."
              />
            )}
          </Section>
        </div>

        <div className="space-y-6">
          {/* Internal notes */}
          <Section title="Internal Notes (admin only)">
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesSaved(false);
              }}
              onBlur={saveNotes}
              rows={5}
              placeholder="Never shown to the client or the team."
              className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
            />
            {notesSaved && <p className="mt-1 text-xs text-emerald-600">Saved</p>}
          </Section>

          {/* Documents, through the same review gate */}
          <Section title="Documents">
            <ul className="space-y-3">
              {documents.map((doc) => (
                <li key={doc.id} className="rounded border border-line bg-paper p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{doc.doc_type}</span>
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
                  <p className="text-xs text-neutral-400">
                    From {doc.author_label ?? "—"}
                    {doc.uploaded_by && usersById[doc.uploaded_by]
                      ? ` (${usersById[doc.uploaded_by].full_name})`
                      : ""}
                  </p>
                  {doc.retention_note && (
                    <p className="mt-1 text-xs text-neutral-400">{doc.retention_note}</p>
                  )}
                  <ReviewControls
                    table="documents"
                    id={doc.id}
                    status={doc.review_status}
                    shareWithClient={doc.share_with_client}
                    shareWithTeam={doc.share_with_team}
                    reviewNote={doc.review_note}
                    onChanged={load}
                  />
                </li>
              ))}
              {documents.length === 0 && (
                <p className="text-sm text-neutral-400">
                  No documents on this case — most verification never needs one.
                </p>
              )}
            </ul>
          </Section>

          {/* Payments */}
          <Section title="Payments">
            <ul className="mb-3 space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded border border-line bg-paper px-3 py-2 text-sm"
                >
                  <div>
                    <div>{p.description}</div>
                    <div className="text-xs text-neutral-400">
                      {p.currency} {p.amount}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge kind="payment" value={p.status} />
                    {p.status !== "paid" && p.status !== "waived" && (
                      <button
                        onClick={() => markPaymentPaid(p.id)}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        Mark paid
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {payments.length === 0 && (
                <p className="text-sm text-neutral-400">No payments logged yet.</p>
              )}
            </ul>
            <div className="space-y-2">
              <input
                value={newPaymentDesc}
                onChange={(e) => setNewPaymentDesc(e.target.value)}
                placeholder="e.g. Status verification fee"
                className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
              />
              <input
                value={newPaymentAmount}
                onChange={(e) => setNewPaymentAmount(e.target.value)}
                type="number"
                placeholder="Amount (USD)"
                className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
              />
              <button
                onClick={logPayment}
                className="w-full rounded bg-navy py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Log payment
              </button>
            </div>
          </Section>
        </div>
      </div>
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

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  const id = `labeled-select-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
