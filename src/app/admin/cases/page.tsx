"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Case, CaseStatus, CaseType } from "@/lib/types";
import { CASE_STATUS_LABELS, CASE_TYPE_LABELS } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import DeleteCaseDialog from "@/components/DeleteCaseDialog";

export default function AllCasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<CaseType | "all">("all");

  const [toDelete, setToDelete] = useState<Case | null>(null);
  const [view, setView] = useState<"active" | "archived">("active");
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });
    setCases((data as Case[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setArchived(c: Case, archived: boolean) {
    setNotice(null);
    const { error } = await supabase
      .from("cases")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", c.id);
    setNotice(
      error
        ? error.message.includes("only_closed")
          ? "Only a Closed case can be archived. Set its status to Closed first."
          : error.message
        : archived
        ? `Archived “${c.title}”. Find it under Archived.`
        : `Restored “${c.title}”.`
    );
    load();
  }

  const archivedCount = useMemo(() => cases.filter((c) => c.archived_at).length, [cases]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (view === "archived" ? !c.archived_at : c.archived_at) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.case_type !== typeFilter) return false;
      return true;
    });
  }, [cases, statusFilter, typeFilter, view]);

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

      <div role="tablist" aria-label="Case list" className="mb-4 flex gap-1 border-b border-line">
        {(["active", "archived"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              view === v ? "border-stamp text-navy" : "border-transparent text-neutral-500 hover:text-navy"
            }`}
          >
            {v === "active" ? "Active" : `Archived (${archivedCount})`}
          </button>
        ))}
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

      {notice && (
        <p role="status" className="mb-3 rounded border border-line bg-white px-3 py-2 text-sm text-neutral-600">{notice}</p>
      )}
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
                <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
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
                    <StatusBadge kind="case" value={c.status} />
                  </td>
                  <td className="px-3 py-2 text-neutral-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.archived_at ? (
                      <button
                        type="button"
                        onClick={() => setArchived(c, false)}
                        aria-label={`Restore case ${c.title}`}
                        className="mr-2 rounded border border-line px-2 py-1 text-xs hover:border-stamp"
                      >
                        Restore
                      </button>
                    ) : (
                      c.status === "closed" && (
                        <button
                          type="button"
                          onClick={() => setArchived(c, true)}
                          aria-label={`Archive case ${c.title}`}
                          className="mr-2 rounded border border-line px-2 py-1 text-xs hover:border-stamp"
                        >
                          Archive
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setToDelete(c)}
                      aria-label={`Delete case ${c.title}`}
                      className="rounded border border-line px-2 py-1 text-xs text-red-600 hover:border-red-400 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-neutral-400">
                    {view === "archived" ? "No archived cases. Close a finished case, then archive it from the Active list." : "No cases match these filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {toDelete && (
        <DeleteCaseDialog
          caseId={toDelete.id}
          title={toDelete.title}
          onClose={() => setToDelete(null)}
          onDeleted={() => {
            setNotice(`Deleted “${toDelete.title}”.`);
            setToDelete(null);
            load();
          }}
        />
      )}
    </div>
  );
}
