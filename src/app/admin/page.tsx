"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Case, CaseStatus, CaseType, Milestone } from "@/lib/types";
import { CASE_STATUS_LABELS, CASE_TYPE_LABELS } from "@/lib/types";
import { statusStyle } from "@/lib/statusStyles";
import BarChart from "@/components/BarChart";
import MilestoneGantt from "@/components/MilestoneGantt";

const COLUMNS: CaseStatus[] = [
  "intake",
  "scoped",
  "in_progress",
  "awaiting_client_payment",
  "report_delivered",
  "closed",
];

const CASE_TYPES: CaseType[] = [
  "property_purchase",
  "ground_up_build",
  "farm_oversight",
  "status_verification",
];

export default function AdminDashboard() {
  const [cases, setCases] = useState<Case[]>([]);
  const [milestonesByCase, setMilestonesByCase] = useState<Record<string, Milestone[]>>({});
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: caseRows } = await supabase
        .from("cases")
        .select("*")
        .order("updated_at", { ascending: false });
      const caseList = (caseRows as Case[]) ?? [];
      setCases(caseList);

      // Milestone timeline is most useful for open work — cap to the 8 most
      // recently updated open cases so the chart stays readable.
      const openCaseIds = caseList
        .filter((c) => c.status !== "closed")
        .slice(0, 8)
        .map((c) => c.id);
      if (openCaseIds.length > 0) {
        const { data: msRows } = await supabase
          .from("milestones")
          .select("*")
          .in("case_id", openCaseIds)
          .order("sequence_order");
        const grouped: Record<string, Milestone[]> = {};
        (msRows as Milestone[] | null)?.forEach((m) => {
          grouped[m.case_id] = grouped[m.case_id] ?? [];
          grouped[m.case_id].push(m);
        });
        setMilestonesByCase(grouped);
      }

      const { count } = await supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "overdue"]);
      setUnpaidCount(count ?? 0);

      // Simple proxy for "unread": messages sent in the last 24h not sent by admin.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: msgCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("sent_at", since);
      setUnreadMessageCount(msgCount ?? 0);

      const [{ count: pr }, { count: pd }] = await Promise.all([
        supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("review_status", "pending"),
        supabase
          .from("documents")
          .select("*", { count: "exact", head: true })
          .eq("review_status", "pending"),
      ]);
      setPendingReviewCount((pr ?? 0) + (pd ?? 0));

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">Loading dashboard…</p>;

  const statusChartData = COLUMNS.map((status) => ({
    label: CASE_STATUS_LABELS[status],
    value: cases.filter((c) => c.status === status).length,
  }));

  const typeChartData = CASE_TYPES.map((type) => ({
    label: CASE_TYPE_LABELS[type],
    value: cases.filter((c) => c.case_type === type).length,
  }));

  const ganttRows = cases
    .filter((c) => c.status !== "closed")
    .slice(0, 8)
    .map((c) => ({
      caseId: c.id,
      caseTitle: c.title,
      milestones: milestonesByCase[c.id] ?? [],
    }));

  return (
    <div>
      <h1 className="mb-6 font-display text-xl font-bold text-navy">Dashboard</h1>

      <div className="mb-6 flex flex-wrap gap-4">
        <Link href="/admin/reports" className="block">
          <SummaryCard label="Awaiting your review" value={pendingReviewCount} accent />
        </Link>
        <SummaryCard label="Open cases" value={cases.filter((c) => c.status !== "closed").length} />
        <SummaryCard label="Unpaid / overdue invoices" value={unpaidCount} accent />
        <SummaryCard label="Messages (last 24h)" value={unreadMessageCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {COLUMNS.map((status) => (
          <div
            key={status}
            className={`rounded-lg border border-t-4 border-line bg-white ${statusStyle("case", status).accent}`}
          >
            <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {CASE_STATUS_LABELS[status]}
              <span className="ml-1 text-neutral-400">
                ({cases.filter((c) => c.status === status).length})
              </span>
            </div>
            <div className="space-y-2 p-2">
              {cases
                .filter((c) => c.status === status)
                .map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/cases/${c.id}`}
                    className="block rounded border border-line bg-paper p-2 text-xs hover:border-stamp"
                  >
                    <div className="font-medium text-navy">{c.title}</div>
                    <div className="text-neutral-500">{CASE_TYPE_LABELS[c.case_type]}</div>
                  </Link>
                ))}
              {cases.filter((c) => c.status === status).length === 0 && (
                <p className="px-1 py-2 text-xs text-neutral-400">—</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-4 mt-10 font-display text-lg font-semibold text-navy">Analytics</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-4">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Cases by status
          </h3>
          <BarChart data={statusChartData} />
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Cases by type
          </h3>
          <BarChart data={typeChartData} />
        </div>
        <div className="rounded-lg border border-line bg-white p-4 lg:col-span-1">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Milestone timeline — open cases
          </h3>
          <MilestoneGantt rows={ganttRows} />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="min-w-[160px] rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`text-2xl font-bold ${accent && value > 0 ? "text-stamp" : "text-navy"}`}>
        {value}
      </div>
    </div>
  );
}
