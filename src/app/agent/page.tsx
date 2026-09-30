"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { Case, Milestone } from "@/lib/types";
import { CASE_TYPE_LABELS, MILESTONE_STATUS_LABELS } from "@/lib/types";
import Badge from "@/components/Badge";

export default function AgentHomePage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [milestonesByCase, setMilestonesByCase] = useState<Record<string, Milestone[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const { data: cs } = await supabase
        .from("cases")
        .select("*")
        .or(`assigned_agent_id.eq.${profile!.id},assigned_professional_id.eq.${profile!.id}`)
        .neq("status", "closed");
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
        const grouped: Record<string, Milestone[]> = {};
        (ms as Milestone[] | null)?.forEach((m) => {
          grouped[m.case_id] = grouped[m.case_id] ?? [];
          grouped[m.case_id].push(m);
        });
        setMilestonesByCase(grouped);
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
          <div key={c.id} className="rounded-lg border border-line bg-white p-4">
            <div className="mb-2">
              <span className="font-semibold text-navy">{c.title}</span>
              <span className="ml-2 text-xs text-neutral-400">{CASE_TYPE_LABELS[c.case_type]}</span>
            </div>
            {c.location_description && (
              <p className="mb-2 text-sm text-neutral-500">{c.location_description}</p>
            )}
            <ul className="space-y-1">
              {(milestonesByCase[c.id] ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span>{m.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge className="border-line text-neutral-600">
                      {MILESTONE_STATUS_LABELS[m.status]}
                    </Badge>
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
          </div>
        ))}
        {cases.length === 0 && (
          <p className="text-sm text-neutral-400">No cases assigned to you yet.</p>
        )}
      </div>
    </div>
  );
}
