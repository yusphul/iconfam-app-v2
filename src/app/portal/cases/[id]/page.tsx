"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type {
  Case,
  Milestone,
  Report,
  MediaItem,
  Payment,
  CaseMessage,
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
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
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
      // RLS already restricts this to client_visible = true for this client.
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
      for (const report of reportList) {
        const { data: mediaRows } = await supabase
          .from("media")
          .select("*")
          .eq("report_id", report.id);
        const urls: string[] = [];
        for (const m of (mediaRows as MediaItem[]) ?? []) {
          const { data: signed } = await supabase.storage
            .from("iconfam-media")
            .createSignedUrl(m.storage_path, 3600);
          if (signed?.signedUrl) urls.push(signed.signedUrl);
        }
        mediaMap[report.id] = urls;
      }
      setMediaByReport(mediaMap);
    }

    const { data: pay } = await supabase.from("payments").select("*").eq("case_id", id);
    setPayments((pay as Payment[]) ?? []);

    const { data: docs } = await supabase.from("documents").select("*").eq("case_id", id);
    const docList = (docs as DocumentRow[]) ?? [];
    setDocuments(docList);
    const docUrlMap: Record<string, string> = {};
    for (const doc of docList) {
      const { data: signed } = await supabase.storage
        .from("iconfam-documents")
        .createSignedUrl(doc.storage_path, 3600);
      if (signed?.signedUrl) docUrlMap[doc.id] = signed.signedUrl;
    }
    setDocumentUrls(docUrlMap);

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

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!caseRow) {
    return (
      <p className="text-sm text-neutral-500">
        We couldn't find that case, or it isn't linked to your account.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy">{caseRow.title}</h1>
        <p className="text-sm text-neutral-500">
          {CASE_TYPE_LABELS[caseRow.case_type]} ·{" "}
          <Badge className="border-line text-neutral-600">
            {CASE_STATUS_LABELS[caseRow.status]}
          </Badge>
        </p>
      </div>

      {/* Milestone timeline */}
      <Section title="Progress">
        <ol className="space-y-2">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded border border-line bg-paper px-3 py-2 text-sm">
              <span>{m.name}</span>
              <Badge className="border-line text-neutral-600">
                {MILESTONE_STATUS_LABELS[m.status]}
              </Badge>
            </li>
          ))}
          {milestones.length === 0 && (
            <p className="text-sm text-neutral-400">Milestones will appear here once scoped.</p>
          )}
        </ol>
      </Section>

      {/* Reports feed */}
      <Section title="Reports">
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded border border-line bg-paper p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <Badge className={REPORT_FLAG_COLORS[r.status_flag]}>
                  {REPORT_FLAG_LABELS[r.status_flag]}
                </Badge>
                <span className="text-xs text-neutral-400">
                  {new Date(r.visit_time).toLocaleDateString()}
                </span>
              </div>
              <p className="text-neutral-700">{r.findings_summary}</p>
              {mediaByReport[r.id]?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {mediaByReport[r.id].map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
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
          {reports.length === 0 && (
            <p className="text-sm text-neutral-400">
              No reports published yet — your verification team is on it.
            </p>
          )}
        </div>
      </Section>

      {/* Documents */}
      <Section title="Documents">
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="rounded border border-line bg-paper px-3 py-2 text-sm">
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
              No documents on this case — we verify directly with the registry in
              most cases, so you're rarely asked to upload anything.
            </p>
          )}
        </ul>
      </Section>

      {/* Payments */}
      <Section title="Payments">
        <ul className="space-y-2">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded border border-line bg-paper px-3 py-2 text-sm">
              <div>
                <div>{p.description}</div>
                <div className="text-xs text-neutral-400">
                  {p.currency} {p.amount}
                </div>
              </div>
              <Badge
                className={
                  p.status === "paid"
                    ? "border-verified/30 bg-verified/10 text-verified"
                    : "border-amber-300 bg-amber-50 text-amber-700"
                }
              >
                {p.status}
              </Badge>
            </li>
          ))}
          {payments.length === 0 && (
            <p className="text-sm text-neutral-400">No fees on this case yet.</p>
          )}
        </ul>
      </Section>

      {/* Messages */}
      <Section title="Messages">
        <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className="rounded border border-line bg-paper p-2 text-sm">
              {m.body}
              <div className="text-xs text-neutral-400">
                {new Date(m.sent_at).toLocaleString()}
              </div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-neutral-400">No messages yet.</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ask a question about this case…"
            className="flex-1 rounded border border-line bg-white px-3 py-2 text-sm"
          />
          <button
            onClick={sendMessage}
            className="rounded bg-stamp px-4 py-2 text-sm font-medium text-white hover:bg-stampDark"
          >
            Send
          </button>
        </div>
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
