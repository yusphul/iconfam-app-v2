"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Case, CaseStatus, CaseType } from "@/lib/types";
import { CASE_STATUS_LABELS, CASE_TYPE_LABELS } from "@/lib/types";
import Badge from "@/components/Badge";

export default function AllCasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<CaseType | "all">("all");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false });
      setCases((data as Case[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.case_type !== typeFilter) return false;
      return true;
    });
  }, [cases, statusFilter, typeFilter]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-navy">All Cases</h1>
        <Link
          href="/admin/cases/new"
          className="rounded bg-stamp px-4 py-2 text-sm font-semibold text-white hover:bg-stampDark"
        >
          + New Case
        </Link>
      </div>

      <div className="mb-4 flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CaseStatus | "all")}
          className="rounded border border-line bg-white px-2 py-1 text-sm"
        >
          <option value="all">All statuses</option>
          {Object.entries(CASE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as CaseType | "all")}
          className="rounded border border-line bg-white px-2 py-1 text-sm"
        >
          <option value="all">All case types</option>
          {Object.entries(CASE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-navy text-left text-white">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={c.id}
                  className={`cursor-pointer border-t border-line hover:bg-paper ${
                    i % 2 === 1 ? "bg-paper/40" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <Link href={`/admin/cases/${c.id}`} className="text-stamp hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{CASE_TYPE_LABELS[c.case_type]}</td>
                  <td className="px-3 py-2">
                    <Badge className="border-line text-neutral-600">
                      {CASE_STATUS_LABELS[c.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-neutral-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-neutral-400">
                    No cases match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
