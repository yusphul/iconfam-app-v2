"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type {
  Case,
  Milestone,
  MilestoneStatus,
  Report,
  Payment,
  CaseMessage,
  AppUser,
  CaseStatus,
  DocumentRow,
} from "@/lib/types";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  REPORT_FLAG_LABELS,
  REPORT_FLAG_COLORS,
  MILESTONE_STATUS_LABELS,
} from "@/lib/types";
import Badge from "@/components/Badge";

export default function AdminCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [caseRow, setCaseRow] = useState<Case | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [usersById, setUsersById] = useState<Record<string, AppUser>>({});
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [professionals, setProfessionals] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [notes, setNotes] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newPaymentDesc, setNewPaymentDesc] = useState("");
  const [newPaymentAmount, setNewPaymentAmount] = useState("");

  const load = useCallback(async () => {
    const [{ data: c }, { data: allUsers }] = await Promise.all([
      supabase.from("cases").select("*").eq("id", id).single(),
      supabase.from("users").select("*"),
    ]);
    setCaseRow(c as Case);

    const usersMap: Record<string, AppUser> = {};
    (allUsers as AppUser[] | null)?.forEach((u) => (usersMap[u.id] = u));
    setUsersById(usersMap);
    setAgents((allUsers as AppUser[] | null)?.filter((u) => u.role === "agent") ?? []);
    setProfessionals(
      (allUsers as AppUser[] | null)?.filter((u) => u.role === "professional") ?? []
    );

    const { data: ms } = await supabase
      .from("milestones")
      .select("*")
      .eq("case_id", id)
      .order("sequence_order");
    setMilestones((ms as Milestone[]) ?? []);

    if (ms && ms.length > 0) {
      const milestoneIds = ms.map((m) => m.id);
      const { data: rp } = await supabase
        .from("reports")
        .select("*")
        .in("milestone_id", milestoneIds)
        .order("created_at", { ascending: false });
      setReports((rp as Report[]) ?? []);
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
    for (const doc of docList) {
      const { data: signed } = await supabase.storage
        .from("iconfam-documents")
        .createSignedUrl(doc.storage_path, 3600);
      if (signed?.signedUrl) urlMap[doc.id] = signed.signedUrl;
    }
    setDocumentUrls(urlMap);

    const { data: msg } = await supabase
      .from("messages")
      .select("*")
      .eq("case_id", id)
      .order("sent_at");
    setMessages((msg as CaseMessage[]) ?? []);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Seeds the notes textarea once per case (keyed on the stable id, not the
  // caseRow object, which is a new reference on every reload) — this is what
  // stops an in-progress edit from being silently overwritten when some other
  // action on the page (sending a message, logging a payment, etc.) triggers
  // a reload before the textarea has blurred and saved.
  useEffect(() => {
    if (caseRow) setNotes(caseRow.internal_notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseRow?.id]);

  async function updateStatus(status: CaseStatus) {
    await supabase.from("cases").update({ status }).eq("id", id);
    load();
  }

  async function reassign(field: "assigned_agent_id" | "assigned_professional_id", value: string) {
    await supabase
      .from("cases")
      .update({ [field]: value || null })
      .eq("id", id);
    load();
  }

  async function saveNotes() {
    await supabase.from("cases").update({ internal_notes: notes }).eq("id", id);
  }

  async function addMilestone() {
    if (!newMilestoneName.trim()) return;
    await supabase.from("milestones").insert({
      case_id: id,
      name: newMilestoneName,
      sequence_order: milestones.length + 1,
    });
    setNewMilestoneName("");
    load();
  }

  async function updateMilestoneStatus(milestoneId: string, status: MilestoneStatus) {
    await supabase.from("milestones").update({ status }).eq("id", milestoneId);
    load();
  }

  async function toggleClientVisible(report: Report) {
    await supabase
      .from("reports")
      .update({ client_visible: !report.client_visible })
      .eq("id", report.id);
    load();
  }

  async function sendMessage() {
    if (!newMessage.trim() || !profile) return;
    await supabase.from("messages").insert({
      case_id: id,
      sender_id: profile.id,
      channel: "portal",
      body: newMessage,
    });
    setNewMessage("");
    load();
  }

  async function logPayment() {
    if (!newPaymentDesc.trim() || !newPaymentAmount) return;
    await supabase.from("payments").insert({
      case_id: id,
      description: newPaymentDesc,
      amount: Number(newPaymentAmount),
      status: "pending",
    });
    setNewPaymentDesc("");
    setNewPaymentAmount("");
    load();
  }

  async function markPaymentPaid(paymentId: string) {
    await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", paymentId);
    load();
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading case…</p>;
  if (!caseRow) {
    return <p className="text-sm text-neutral-500">No case found with that ID.</p>;
  }

  const client = usersById[caseRow.client_id];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy">{caseRow.title}</h1>
        <p className="text-sm text-neutral-500">
          {CASE_TYPE_LABELS[caseRow.case_type]} · Client: {client?.full_name ?? "—"}
          {caseRow.location_description ? ` · ${caseRow.location_description}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Status + assignment */}
          <Section title="Status & Assignment">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <LabeledSelect
                label="Status"
                value={caseRow.status}
                onChange={(v) => updateStatus(v as CaseStatus)}
                options={Object.entries(CASE_STATUS_LABELS)}
              />
              <LabeledSelect
                label="Field agent"
                value={caseRow.assigned_agent_id ?? ""}
                onChange={(v) => reassign("assigned_agent_id", v)}
                options={[["", "Unassigned"], ...agents.map((a) => [a.id, a.full_name] as [string, string])]}
              />
              <LabeledSelect
                label="Professional"
                value={caseRow.assigned_professional_id ?? ""}
                onChange={(v) => reassign("assigned_professional_id", v)}
                options={[
                  ["", "Unassigned"],
                  ...professionals.map((p) => [p.id, p.full_name] as [string, string]),
                ]}
              />
            </div>
          </Section>

          {/* Milestones */}
          <Section title="Milestones">
            <ul className="mb-3 space-y-2">
              {milestones.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded border border-line bg-paper px-3 py-2 text-sm"
                >
                  <span>{m.name}</span>
                  <select
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
                </li>
              ))}
              {milestones.length === 0 && (
                <p className="text-sm text-neutral-400">No milestones yet.</p>
              )}
            </ul>
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

          {/* Reports queue for this case */}
          <Section title="Reports">
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="rounded border border-line bg-paper p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <Badge className={REPORT_FLAG_COLORS[r.status_flag]}>
                      {REPORT_FLAG_LABELS[r.status_flag]}
                    </Badge>
                    <span className="text-xs text-neutral-400">
                      {new Date(r.visit_time).toLocaleString()}
                    </span>
                  </div>
                  <p className="mb-2 text-neutral-700">{r.findings_summary}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">
                      Submitted by {usersById[r.submitted_by]?.full_name ?? "—"}
                    </span>
                    <button
                      onClick={() => toggleClientVisible(r)}
                      className={`rounded px-2 py-1 font-medium ${
                        r.client_visible
                          ? "bg-verified/10 text-verified"
                          : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {r.client_visible ? "Visible to client" : "Hidden — click to publish"}
                    </button>
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <p className="text-sm text-neutral-400">No reports submitted yet.</p>
              )}
            </div>
          </Section>

          {/* Messages */}
          <Section title="Messages">
            <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className="rounded border border-line bg-paper p-2 text-sm">
                  <span className="font-medium text-navy">
                    {usersById[m.sender_id]?.full_name ?? "—"}:
                  </span>{" "}
                  {m.body}
                  <div className="text-xs text-neutral-400">
                    {new Date(m.sent_at).toLocaleString()} · {m.channel}
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-sm text-neutral-400">No messages yet.</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Send a message on this case…"
                className="flex-1 rounded border border-line bg-paper px-3 py-2 text-sm"
              />
              <button
                onClick={sendMessage}
                className="rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Send
              </button>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          {/* Internal notes */}
          <Section title="Internal Notes (admin only)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={5}
              placeholder="Never shown to the client."
              className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
            />
          </Section>

          {/* Documents */}
          <Section title="Documents">
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="rounded border border-line bg-paper px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
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
                  {doc.retention_note && (
                    <p className="mt-1 text-xs text-neutral-400">{doc.retention_note}</p>
                  )}
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
                  className="flex items-center justify-between rounded border border-line bg-paper px-3 py-2 text-sm"
                >
                  <div>
                    <div>{p.description}</div>
                    <div className="text-xs text-neutral-400">
                      {p.currency} {p.amount}
                    </div>
                  </div>
                  {p.status === "paid" ? (
                    <Badge className="border-verified/30 bg-verified/10 text-verified">Paid</Badge>
                  ) : (
                    <button
                      onClick={() => markPaymentPaid(p.id)}
                      className="rounded bg-verified px-2 py-1 text-xs font-medium text-white"
                    >
                      Mark paid
                    </button>
                  )}
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
