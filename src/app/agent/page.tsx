"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { Case, Milestone, Report } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import { statusStyle } from "@/lib/statusStyles";
import { timeAgo } from "@/lib/format";
import { assigneeChip, canWorkMilestone } from "@/lib/milestoneAssignment";
import { canSubmitReport } from "@/lib/reportMedia";
import StatusBadge from "@/components/StatusBadge";
import Disclosure from "@/components/portal/Disclosure";
import { Chevron } from "@/components/CollapsibleSection";

export default function AgentHomePage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [milestonesByCase, setMilestonesByCase] = useState<Record<string, Milestone[]>>({});
  const [rejectedByCase, setRejectedByCase] = useState<Record<string, number>>({});
  const [pendingByCase, setPendingByCase] = useState<Record<string, number>>({});
  const [mineByMilestone, setMineByMilestone] = useState<Record<string, { review_status: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(false);

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
          const mine: Record<string, { review_status: string }[]> = {};
          ((rp as Pick<Report, "id" | "milestone_id" | "review_status">[]) ?? []).forEach((r) => {
            (mine[r.milestone_id] ??= []).push({ review_status: r.review_status });
          });
          setMineByMilestone(mine);
          setRejectedByCase(rejected);
          setPendingByCase(pending);
        }
      }
      setLoading(false);
    }
    load();
  }, [profile]);

  // Open the first case so the page isn't a wall of closed panels.
  useEffect(() => {
    if (!seeded && cases.length > 0) {
      setOpen(new Set([cases[0].id]));
      setSeeded(true);
    }
  }, [cases, seeded]);

  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) return <DashboardSkeleton />;

  const rejectedTotal = Object.values(rejectedByCase).reduce((a, b) => a + b, 0);
  const pendingTotal = Object.values(pendingByCase).reduce((a, b) => a + b, 0);
  const firstName = (profile?.full_name ?? "").trim().split(/\s+/)[0];
  const allOpen = cases.length > 0 && open.size === cases.length;

  return (
    <div className="space-y-6">
      <div className="rise-in flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">
            {firstName ? `Hello, ${firstName}` : "My assigned cases"}
          </h1>
          <p className="text-sm text-neutral-500">
            {cases.length === 0
              ? "Nothing assigned yet."
              : `You have ${cases.length} active ${cases.length === 1 ? "case" : "cases"}.`}
          </p>
        </div>
        {cases.length > 1 && (
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => setOpen(allOpen ? new Set() : new Set(cases.map((c) => c.id)))}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {cases.length > 0 && (
        <div className="rise-in grid grid-cols-3 gap-3" style={{ animationDelay: "60ms" }}>
          <Tile label="Active cases" value={cases.length} tone="text-navy" />
          <Tile label="Need a fix" value={rejectedTotal} tone={rejectedTotal ? "text-red-600" : "text-neutral-400"} />
          <Tile label="With the admin" value={pendingTotal} tone={pendingTotal ? "text-amber-600" : "text-neutral-400"} />
        </div>
      )}

      <div className="space-y-4">
        {cases.map((c, idx) => {
          const ms = milestonesByCase[c.id] ?? [];
          const done = ms.filter((m) => m.status === "confirmed").length;
          const isOpen = open.has(c.id);
          return (
            <section
              key={c.id}
              className={`rise-in card-lift overflow-hidden rounded-2xl border border-l-4 border-line bg-white shadow-sm ${statusStyle("case", c.status).accent}`}
              style={{ animationDelay: `${120 + idx * 50}ms` }}
            >
              <button
                type="button"
                onClick={() => toggle(c.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 px-4 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-stamp sm:px-5"
              >
                <span className="mt-1"><Chevron open={isOpen} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-display text-base font-semibold text-navy">{c.title}</span>
                    <span className="text-xs text-neutral-400">{CASE_TYPE_LABELS[c.case_type]}</span>
                  </span>
                  {c.location_description && (
                    <span className="mt-0.5 block truncate text-sm text-neutral-500">{c.location_description}</span>
                  )}
                  <span className="mt-2 flex items-center gap-2">
                    <span className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-verified transition-all duration-500"
                        style={{ width: ms.length ? `${(done / ms.length) * 100}%` : "0%" }}
                      />
                    </span>
                    <span className="text-xs text-neutral-500">
                      {ms.length ? `${done} of ${ms.length} steps confirmed` : "No steps yet"}
                    </span>
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1.5">
                  <StatusBadge kind="case" value={c.status} />
                  {rejectedByCase[c.id] > 0 && (
                    <StatusBadge kind="review" value="rejected" label={`${rejectedByCase[c.id]} to fix`} />
                  )}
                  {pendingByCase[c.id] > 0 && (
                    <StatusBadge kind="review" value="pending" label={`${pendingByCase[c.id]} in review`} />
                  )}
                </span>
              </button>

              <Disclosure open={isOpen}>
                <div className="border-t border-line px-4 py-4 sm:px-5">
                  <ul className="space-y-2">
                    {ms.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2.5 text-sm transition hover:bg-sectionTint/70"
                      >
                        <span className="min-w-0 text-navy">
                          {m.name}
                          {assigneeChip(m, profile?.id) && (
                            <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[11px] text-neutral-500 ring-1 ring-line">
                              {assigneeChip(m, profile?.id)}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <StatusBadge kind="milestone" value={m.status} />
                          {canWorkMilestone(m, profile?.id) &&
                            (canSubmitReport(mineByMilestone[m.id] ?? []) ? (
                              <Link href={`/agent/submit/${m.id}`} className="btn-primary btn-sm">
                                {(mineByMilestone[m.id] ?? []).length > 0 ? "Resubmit report" : "Submit report"}
                              </Link>
                            ) : (
                              <span className="text-xs font-medium text-neutral-500">Report sent</span>
                            ))}
                        </div>
                      </li>
                    ))}
                    {ms.length === 0 && (
                      <li className="text-sm text-neutral-400">No milestones set yet — check with admin.</li>
                    )}
                  </ul>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Updated {timeAgo(c.updated_at)}</span>
                    <Link href={`/agent/cases/${c.id}`} className="btn-navy btn-sm">
                      Open case
                    </Link>
                  </div>
                </div>
              </Disclosure>
            </section>
          );
        })}
        {cases.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-neutral-500">
            No cases assigned to you yet. You'll get an email when the admin assigns one.
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card-lift rounded-2xl border border-line bg-white p-3.5 shadow-sm sm:p-4">
      <p className={`font-display text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading your cases">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
  );
}
