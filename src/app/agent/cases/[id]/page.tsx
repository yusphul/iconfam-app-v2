"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { Case, Milestone, Report } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import { statusStyle, LABEL_CHIP } from "@/lib/statusStyles";
import { timeAgo } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import BackLink from "@/components/BackLink";
import MessageThread from "@/components/MessageThread";

// A field agent's / professional's view of one case. They only ever see their
// own reports here (plus anything the admin has approved for the case team),
// and their only line of communication is the thread with the admin team —
// never the client.

export default function AgentCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [caseRow, setCaseRow] = useState<Case | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMilestone, setNewMilestone] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProfessional = profile?.role === "professional";

  const load = useCallback(async () => {
    const { data: c } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
    setCaseRow((c as Case) ?? null);

    const { data: ms } = await supabase
      .from("milestones")
      .select("*")
      .eq("case_id", id)
      .order("sequence_order");
    const milestoneList = (ms as Milestone[]) ?? [];
    setMilestones(milestoneList);

    if (milestoneList.length > 0) {
      const { data: rp } = await supabase
        .from("reports")
        .select("*")
        .in(
          "milestone_id",
          milestoneList.map((m) => m.id)
        )
        .order("created_at", { ascending: false });
      setReports((rp as Report[]) ?? []);
    } else {
      setReports([]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    const name = newMilestone.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    const { error: err } = await supabase.from("milestones").insert({
      case_id: id,
      name,
      sequence_order: milestones.length + 1,
    });
    setAdding(false);
    if (err) {
      setError("Couldn't add that milestone — you can only add to cases you're assigned to.");
      return;
    }
    setNewMilestone("");
    load();
  }

  const reportsByMilestone = useMemo(() => {
    const grouped: Record<string, Report[]> = {};
    for (const r of reports) (grouped[r.milestone_id] ??= []).push(r);
    return grouped;
  }, [reports]);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!caseRow || !profile) {
    return (
      <div>
        <BackLink href="/agent">My cases</BackLink>
        <p className="text-sm text-neutral-500">
          We couldn&apos;t find that case, or it isn&apos;t assigned to you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/agent">My cases</BackLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-navy">{caseRow.title}</h1>
            <p className="text-sm text-neutral-500">
              {CASE_TYPE_LABELS[caseRow.case_type]}
              {caseRow.location_description ? ` · ${caseRow.location_description}` : ""}
            </p>
          </div>
          <StatusBadge kind="case" value={caseRow.status} />
        </div>
      </div>

      {profile.role === "agent" && (
        <p
          role="status"
          className={`rounded border px-3 py-2 text-sm ${
            caseRow.site_lat != null
              ? "border-line bg-paper text-neutral-600"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {caseRow.site_lat != null
            ? `Site: ${caseRow.site_address ?? caseRow.location_description ?? "marked on the map"}. You must be there, and check in, before you can send photos or a report.`
            : "The site hasn't been pinned on the map yet. You can't check in or send a report until an admin confirms the location."}
        </p>
      )}

      <Section title="Milestones">
        <ol className="space-y-3">
          {milestones.map((m, i) => {
            const mine = (reportsByMilestone[m.id] ?? []).filter(
              (r) => r.submitted_by === profile.id
            );
            return (
              <li
                key={m.id}
                className={`rounded-lg border border-l-4 border-line bg-white ${statusStyle("milestone", m.status).accent}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-paper text-xs font-semibold text-neutral-500 ring-1 ring-line">
                      {i + 1}
                    </span>
                    <span className="font-medium text-navy">{m.name}</span>
                    {m.owner_label && <span className={LABEL_CHIP}>{m.owner_label}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge kind="milestone" value={m.status} />
                    <Link
                      href={`/agent/submit/${m.id}`}
                      className="rounded bg-stamp px-2 py-1 text-xs font-semibold text-white hover:bg-stampDark"
                    >
                      Submit report
                    </Link>
                  </div>
                </div>

                {mine.length > 0 && (
                  <div className="space-y-2 border-t border-line bg-paper/60 px-4 py-3">
                    {mine.map((r) => (
                      <div key={r.id} className="rounded border border-line bg-white p-3 text-sm">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <StatusBadge kind="report" value={r.status_flag} />
                            <StatusBadge kind="review" value={r.review_status} />
                          </div>
                          <span className="text-xs text-neutral-400">{timeAgo(r.created_at)}</span>
                        </div>
                        <p className="text-neutral-700">{r.findings_summary}</p>
                        {r.review_status === "rejected" && r.review_note && (
                          <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                            <span className="font-semibold">Admin feedback: </span>
                            {r.review_note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
          {milestones.length === 0 && (
            <p className="text-sm text-neutral-400">No milestones yet.</p>
          )}
        </ol>

        {isProfessional && (
          <form onSubmit={addMilestone} className="mt-4 flex gap-2">
            <input
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              aria-label="New milestone"
              placeholder="Add a milestone, e.g. Survey plan check"
              className="flex-1 rounded border border-line bg-paper px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={adding}
              className="rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              Add milestone
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Section>

      <Section title="Messages to admin">
        <p className="mb-3 text-xs text-neutral-400">
          This is a private line to the iConfam admin team. All communication about the case goes
          through here.
        </p>
        <MessageThread
          caseId={id}
          threadUserId={profile.id}
          currentUserId={profile.id}
          labelFor={() => "iConfam admin"}
          placeholder="Message the admin team…"
          emptyText="No messages yet."
        />
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
