"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Report, Milestone, Case, AppUser } from "@/lib/types";
import { REPORT_FLAG_LABELS, REPORT_FLAG_COLORS } from "@/lib/types";
import Badge from "@/components/Badge";

interface EnrichedReport extends Report {
  milestoneName: string;
  caseId: string;
  caseTitle: string;
  submitterName: string;
}

export default function ReportsQueuePage() {
  const [reports, setReports] = useState<EnrichedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    const [{ data: rp }, { data: ms }, { data: cs }, { data: us }] = await Promise.all([
      supabase.from("reports").select("*").order("created_at", { ascending: false }),
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

    const enriched: EnrichedReport[] = ((rp as Report[]) ?? []).map((r) => {
      const milestone = milestonesById[r.milestone_id];
      const caseRow = milestone ? casesById[milestone.case_id] : undefined;
      return {
        ...r,
        milestoneName: milestone?.name ?? "—",
        caseId: caseRow?.id ?? "",
        caseTitle: caseRow?.title ?? "—",
        submitterName: usersById[r.submitted_by]?.full_name ?? "—",
      };
    });
    setReports(enriched);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(report: EnrichedReport) {
    await supabase.from("reports").update({ client_visible: true }).eq("id", report.id);
    load();
  }

  const visibleList = showAll ? reports : reports.filter((r) => !r.client_visible);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-navy">Reports Queue</h1>
        <label className="flex items-center gap-2 text-sm text-neutral-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show already-published reports too
        </label>
      </div>

      <div className="space-y-3">
        {visibleList.map((r) => (
          <div key={r.id} className="rounded-lg border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <Link href={`/admin/cases/${r.caseId}`} className="font-medium text-stamp hover:underline">
                {r.caseTitle}
              </Link>
              <Badge className={REPORT_FLAG_COLORS[r.status_flag]}>
                {REPORT_FLAG_LABELS[r.status_flag]}
              </Badge>
            </div>
            <p className="mb-1 text-xs text-neutral-400">
              Milestone: {r.milestoneName} · Submitted by {r.submitterName} ·{" "}
              {new Date(r.visit_time).toLocaleString()}
            </p>
            <p className="mb-3 text-sm text-neutral-700">{r.findings_summary}</p>
            {!r.client_visible ? (
              <button
                onClick={() => approve(r)}
                className="rounded bg-verified px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Approve — make visible to client
              </button>
            ) : (
              <Badge className="border-verified/30 bg-verified/10 text-verified">Published</Badge>
            )}
          </div>
        ))}
        {visibleList.length === 0 && (
          <p className="text-sm text-neutral-400">
            {showAll ? "No reports at all yet." : "Nothing pending review. 🎉"}
          </p>
        )}
      </div>
    </div>
  );
}
