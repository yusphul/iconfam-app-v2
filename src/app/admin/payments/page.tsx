"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Payment, Case } from "@/lib/types";
import Badge from "@/components/Badge";

export default function PaymentsOverviewPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [casesById, setCasesById] = useState<Record<string, Case>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("cases").select("*"),
    ]);
    setPayments((p as Payment[]) ?? []);
    const map: Record<string, Case> = {};
    (c as Case[] | null)?.forEach((row) => (map[row.id] = row));
    setCasesById(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markPaid(id: string) {
    await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    load();
  }

  const totalOutstanding = payments
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-navy">Payments</h1>
        <div className="rounded-lg border border-line bg-white px-4 py-2 text-sm">
          Outstanding: <span className="font-bold text-stamp">${totalOutstanding.toFixed(2)}</span>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy text-left text-white">
            <tr>
              <th className="px-3 py-2">Case</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p, i) => (
              <tr key={p.id} className={`border-t border-line ${i % 2 === 1 ? "bg-paper/40" : ""}`}>
                <td className="px-3 py-2">
                  <Link href={`/admin/cases/${p.case_id}`} className="text-stamp hover:underline">
                    {casesById[p.case_id]?.title ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.description}</td>
                <td className="px-3 py-2">
                  {p.currency} {p.amount}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    className={
                      p.status === "paid"
                        ? "border-verified/30 bg-verified/10 text-verified"
                        : "border-amber-300 bg-amber-50 text-amber-700"
                    }
                  >
                    {p.status}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {p.status !== "paid" && (
                    <button
                      onClick={() => markPaid(p.id)}
                      className="rounded bg-verified px-2 py-1 text-xs font-medium text-white"
                    >
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-400">
                  No payments logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
