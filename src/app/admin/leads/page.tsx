"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Lead } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

type Filter = "open" | "converted" | "closed";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");

  useEffect(() => {
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLeads((data as Lead[]) ?? []);
        setLoading(false);
      });
  }, []);

  const shown = useMemo(() => {
    const keep = (l: Lead) =>
      filter === "open"
        ? ["new", "call_booked", "call_done"].includes(l.stage)
        : filter === "converted"
          ? l.stage === "converted"
          : l.stage === "lost";
    const list = leads.filter(keep);
    // Open leads: calls coming up first (soonest on top), then those still needing a call.
    if (filter === "open") {
      const rank = (l: Lead) => (l.call_at ? 0 : 1);
      list.sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a.call_at && b.call_at ? +new Date(a.call_at) - +new Date(b.call_at) : +new Date(b.created_at) - +new Date(a.created_at))
      );
    }
    return list;
  }, [leads, filter]);

  const counts = {
    open: leads.filter((l) => ["new", "call_booked", "call_done"].includes(l.stage)).length,
    converted: leads.filter((l) => l.stage === "converted").length,
    closed: leads.filter((l) => l.stage === "lost").length,
  };

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-bold text-navy">Leads</h1>
      <p className="mb-5 text-sm text-neutral-500">
        Everyone who has shown interest. Hold the intake call, take notes, then send a quote.
      </p>

      <div role="tablist" aria-label="Lead filter" className="mb-4 flex gap-2">
        {(
          [
            ["open", "Open"],
            ["converted", "Quoted"],
            ["closed", "Closed"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              filter === key ? "border-navy bg-navy text-white" : "border-line bg-white text-neutral-600 hover:border-slate-400"
            }`}
          >
            {label} <span className="opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy text-left text-white">
            <tr>
              <th className="px-3 py-2">Who</th>
              <th className="px-3 py-2">What</th>
              <th className="px-3 py-2">Call</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Received</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l, i) => (
              <tr key={l.id} className={`border-t border-line ${i % 2 === 1 ? "bg-paper/40" : ""}`}>
                <td className="px-3 py-2">
                  <Link href={`/admin/leads/${l.id}`} className="font-medium text-stamp hover:underline">
                    {l.name}
                  </Link>
                  <div className="text-xs text-neutral-400">{l.email}</div>
                </td>
                <td className="px-3 py-2">
                  <div>{l.summary}</div>
                  <div className="text-xs text-neutral-400">{CASE_TYPE_LABELS[l.service]}</div>
                </td>
                <td className="px-3 py-2">
                  {l.call_at ? (
                    <>
                      {new Date(l.call_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      <div className="text-xs text-neutral-400">{l.call_minutes} min</div>
                    </>
                  ) : (
                    <span className="text-neutral-400">Not booked</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge kind="lead" value={l.stage} />
                </td>
                <td className="px-3 py-2 text-neutral-500">{new Date(l.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-400">
                  Nothing here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
