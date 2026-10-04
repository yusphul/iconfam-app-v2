"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type {
  Report,
  Milestone,
  Case,
  AppUser,
  DocumentRow,
  MediaItem,
  ReviewState,
} from "@/lib/types";
import { roleLabel } from "@/lib/types";
import { detectContactInfo, timeAgo } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import ReviewControls from "@/components/ReviewControls";

// The admin's second pair of eyes. Everything a field agent or professional
// submits lands here first; nothing reaches the client or the rest of the
// case team until it is approved (and shared) from this screen.

type Item =
  | { kind: "report"; row: Report; caseId: string; caseTitle: string; context: string }
  | { kind: "document"; row: DocumentRow; caseId: string; caseTitle: string; context: string };

const FILTERS: { value: ReviewState | "all"; label: string }[] = [
  { value: "pending", label: "Awaiting review" },
  { value: "rejected", label: "Rejected" },
  { value: "approved", label: "Approved" },
  { value: "all", label: "All" },
];

export default function ReviewQueuePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [media, setMedia] = useState<Record<string, string[]>>({});
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<ReviewState | "all">("pending");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: rp }, { data: dc }, { data: ms }, { data: cs }, { data: us }] =
      await Promise.all([
        supabase.from("reports").select("*").order("created_at", { ascending: false }),
        supabase.from("documents").select("*").order("created_at", { ascending: false }),
        supabase.from("milestones").select("*"),
        supabase.from("cases").select("*"),
        supabase.from("users").select("*"),
      ]);

    const milestonesById: Record<string, Milestone> = {};
    (ms as Milestone[] | null)?.forEach((m) => (milestonesById[m.id] = m));
    const casesById: Record<string, Case> = {};
    (cs as Case[] | null)?.forEach((c) => (casesById[c.id] = c));
    const usersById: Record<string, AppUser> = {};
    (us as AppUser[] | null)?.forEach((u) => (usersById[u.id] = u));

    const who = (id: string | null) => {
      const u = id ? usersById[id] : undefined;
      return u ? `${roleLabel(u)} · ${u.full_name}` : "—";
    };

    const list: Item[] = [];
    for (const r of (rp as Report[]) ?? []) {
      const m = milestonesById[r.milestone_id];
      const c = m ? casesById[m.case_id] : undefined;
      list.push({
        kind: "report",
        row: r,
        caseId: c?.id ?? "",
        caseTitle: c?.title ?? "—",
        context: `Milestone: ${m?.name ?? "—"} · From ${who(r.submitted_by)}`,
      });
    }
    const docList = (dc as DocumentRow[]) ?? [];
    for (const d of docList) {
      const c = casesById[d.case_id];
      list.push({
        kind: "document",
        row: d,
        caseId: c?.id ?? "",
        caseTitle: c?.title ?? "—",
        context: `${d.doc_type} · From ${who(d.uploaded_by)}`,
      });
    }
    list.sort((a, b) => b.row.created_at.localeCompare(a.row.created_at));
    setItems(list);

    // Photos for reports, and a link for each document, so the admin can
    // actually look at what is being approved.
    const mediaMap: Record<string, string[]> = {};
    await Promise.all(
      ((rp as Report[]) ?? []).map(async (report) => {
        const { data: rows } = await supabase.from("media").select("*").eq("report_id", report.id);
        const mediaRows = (rows as MediaItem[]) ?? [];
        if (mediaRows.length === 0) return;
        const { data: signed } = await supabase.storage
          .from("iconfam-media")
          .createSignedUrls(
            mediaRows.map((m) => m.storage_path),
            3600
          );
        mediaMap[report.id] = (signed ?? [])
          .map((s) => s.signedUrl)
          .filter((u): u is string => Boolean(u));
      })
    );
    setMedia(mediaMap);

    const urls: Record<string, string> = {};
    await Promise.all(
      docList.map(async (d) => {
        const { data: signed } = await supabase.storage
          .from("iconfam-documents")
          .createSignedUrl(d.storage_path, 3600);
        if (signed?.signedUrl) urls[d.id] = signed.signedUrl;
      })
    );
    setDocUrls(urls);

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const count = (s: ReviewState) => items.filter((i) => i.row.review_status === s).length;
  const visible = items.filter((i) => filter === "all" || i.row.review_status === filter);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-navy">Review Queue</h1>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                filter === f.value
                  ? "border-navy bg-navy text-white"
                  : "border-line bg-white text-neutral-600 hover:bg-paper"
              }`}
            >
              {f.label}
              {f.value !== "all" && ` (${count(f.value)})`}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Reports and documents from field agents and professionals. Nothing is shared with the
        client or the case team until you approve it.
      </p>

      <div className="space-y-3">
        {visible.map((item) => {
          const r = item.row;
          const text = item.kind === "report" ? item.row.findings_summary : "";
          const warn = detectContactInfo(text);
          return (
            <div
              key={`${item.kind}-${r.id}`}
              className="rounded-lg border border-line bg-white p-4"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-paper px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 ring-1 ring-line">
                    {item.kind}
                  </span>
                  {item.caseId ? (
                    <Link
                      href={`/admin/cases/${item.caseId}`}
                      className="font-medium text-stamp hover:underline"
                    >
                      {item.caseTitle}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.caseTitle}</span>
                  )}
                </div>
                {item.kind === "report" ? (
                  <StatusBadge kind="report" value={item.row.status_flag} />
                ) : (
                  <StatusBadge kind="review" value={r.review_status} />
                )}
              </div>
              <p className="mb-2 text-xs text-neutral-400">
                {item.context} · {timeAgo(r.created_at)}
              </p>

              {item.kind === "report" && (
                <>
                  <p className="text-sm text-neutral-700">{item.row.findings_summary}</p>
                  {media[r.id]?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {media[r.id].map((url, idx) => (
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
                </>
              )}
              {item.kind === "document" && docUrls[r.id] && (
                <a
                  href={docUrls[r.id]}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-stamp hover:underline"
                >
                  Open document
                </a>
              )}

              {warn.length > 0 && (
                <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  ⚠ Possible contact details in this text ({warn.join(", ")}). Check before
                  sharing.
                </p>
              )}

              <ReviewControls
                table={item.kind === "report" ? "reports" : "documents"}
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
        {visible.length === 0 && (
          <p className="text-sm text-neutral-400">
            {filter === "pending" ? "Nothing waiting for review. 🎉" : "Nothing here."}
          </p>
        )}
      </div>
    </div>
  );
}
