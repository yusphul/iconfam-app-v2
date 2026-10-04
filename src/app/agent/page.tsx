"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { Case, Milestone, Report } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import { statusStyle } from "@/lib/statusStyles";
import { timeAgo } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";

export default function AgentHomePage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [milestonesByCase, setMilestonesByCase] = useState<Record<string, Milestone[]>>({});
  const [rejectedByCase, setRejectedByCase] = useState<Record<string, number>>({});
  const [pendingByCase, setPendingByCase] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      // Cases come from two places: a field agent is set directly on the case;
      // professionals are linked through case_professionals. The database only
      // returns the rows this person may see.
      const { data: links } = await supabase
        .from("case_professionals")
        .select("case_id")
        .eq("professional_id", profile!.id);
      const proIds = ((links as { case_id: string }[] | null) ?? []).map((l) => l.case_id);

      const filters = [`assigned_agent_id.eq.${profile!.id}`];
      if (proIds.length > 0) filters.push(`id.in.(${proIds.join(",")})`);
      const { data: cs } = await supabase
        .from("cases")
        .select("*")
        .or(filters.join(","))
        .neq("status", "closed")
        .order("updated_at", { ascending: false });
      const caseList = (cs as Case[]) ?? [];
      setCases(caseList);

      if (caseList.length > 0) {
        const { data: ms } = await supabase
          .from("milestones")
          .select("*")
          .in(
            "case_id",
            caseList.map((c) => c.id)
          )
          .order("sequence_order");
        const milestones = (ms as Milestone[]) ?? [];
        const grouped: Record<string, Milestone[]> = {};
        milestones.forEach((m) => {
          grouped[m.case_id] = grouped[m.case_id] ?? [];
          grouped[m.case_id].push(m);
        });
        setMilestonesByCase(grouped);

        // My own submissions that need attention: rejected (fix and resubmit)
        // or still waiting on the admin.
        if (milestones.length > 0) {
          const { data: rp } = await supabase
            .from("reports")
            .select("id, milestone_id, review_status")
            .eq("submitted_by", profile!.id)
            .in(
              "milestone_id",
              milestones.map((m) => m.id)
            );
          const caseOfMilestone: Record<string, string> = {};
          milestones.forEach((m) => (caseOfMilestone[m.id] = m.case_id));
          const rejected: Record<string, number> = {};
          const pending: Record<string, number> = {};
          ((rp as Pick<Report, "id" | "milestone_id" | "review_status">[]) ?? []).forEach((r) => {
            const caseId = caseOfMilestone[r.milestone_id];
            if (r.review_status === "rejected") rejected[caseId] = (rejected[caseId] ?? 0) + 1;
            if (r.review_status === "pending") pending[caseId] = (pending[caseId] ?? 0) + 1;
          });
          setRejectedByCase(rejected);
          setPendingByCase(pending);
        }
      }
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) return <p className="text-sm text-neutral-500">Loading your assigned cases…</p>;

  return (
    <div>
      <h1 className="mb-4 font-display text-xl font-bold text-navy">My Assigned Cases</h1>
      <div className="space-y-4">
        {cases.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg border border-l-4 border-line bg-white p-4 ${statusStyle("case", c.status).accent}`}
          >
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/agent/cases/${c.id}`}
                  className="font-semibold text-navy hover:text-stamp hover:underline"
                >
                  {c.title}
                </Link>
                <span className="ml-2 text-xs text-neutral-400">{CASE_TYPE_LABELS[c.case_type]}</span>
              </div>
              <StatusBadge kind="case" value={c.status} />
            </div>
            {c.location_description && (
              <p className="mb-2 text-sm text-neutral-500">{c.location_description}</p>
            )}

            {(rejectedByCase[c.id] > 0 || pendingByCase[c.id] > 0) && (
              <div className="mb-2 flex flex-wrap gap-2">
                {rejectedByCase[c.id] > 0 && (
                  <StatusBadge
                    kind="review"
                    value="rejected"
                    label={`${rejectedByCase[c.id]} rejected — needs a fix`}
                  />
                )}
                {pendingByCase[c.id] > 0 && (
                  <StatusBadge
                    kind="review"
                    value="pending"
                    label={`${pendingByCase[c.id]} awaiting admin review`}
                  />
                )}
              </div>
            )}

            <ul className="space-y-1">
              {(milestonesByCase[c.id] ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{m.name}</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge kind="milestone" value={m.status} />
                    <Link
                      href={`/agent/submit/${m.id}`}
                      className="rounded bg-stamp px-2 py-1 text-xs font-semibold text-white hover:bg-stampDark"
                    >
                      Submit report
                    </Link>
                  </div>
                </li>
              ))}
              {(milestonesByCase[c.id] ?? []).length === 0 && (
                <li className="text-sm text-neutral-400">No milestones set yet — check with admin.</li>
              )}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs">
              <span className="text-neutral-400">Updated {timeAgo(c.updated_at)}</span>
              <Link href={`/agent/cases/${c.id}`} className="font-medium text-stamp hover:underline">
                Open case &rsaquo;
              </Link>
            </div>
          </div>
        ))}
        {cases.length === 0 && (
          <p className="text-sm text-neutral-400">No cases assigned to you yet.</p>
        )}
      </div>
    </div>
  );
}
