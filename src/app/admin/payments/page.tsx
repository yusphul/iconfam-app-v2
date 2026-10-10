"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Payment, Case, PaymentStatus } from "@/lib/types";
import { CASE_TYPE_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import ColumnChart from "@/components/ColumnChart";
import {
  RANGE_LABELS,
  Range,
  fmtNgn,
  fmtUsd,
  fmtUsdShort,
  inRange,
  incomeBy,
  monthlyIncome,
  summarize,
  toCsv,
  type Slice,
} from "@/lib/finance";

const KIND_LABELS: Record<string, string> = {
  deposit: "Deposits",
  balance: "Balances",
  milestone: "Milestone payments",
  other: "Other",
};
const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  bank_usd: "Bank transfer (USD)",
  bank_ngn: "Bank transfer (NGN)",
  other: "Other / not recorded",
};

function Tile({ label, value, sub, tone = "text-navy" }: { label: string; value: string; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function Bars({ title, rows, empty }: { title: string; rows: Slice[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-400">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-neutral-600">
                  {r.label} <span className="text-neutral-400">· {r.count}</span>
                </span>
                <span className="font-semibold tabular-nums text-navy">
                  {fmtUsd(r.value)}
                  <span className="ml-1 font-normal text-neutral-400">{total > 0 ? Math.round((r.value / total) * 100) : 0}%</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-line/70">
                <div className="h-full rounded-full bg-stamp" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PaymentsOverviewPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [casesById, setCasesById] = useState<Record<string, Case>>({});
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("all");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");

  async function load() {
    const [{ data: p }, { data: c }, { data: bs }] = await Promise.all([
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("cases").select("*"),
      supabase.from("booking_settings").select("usd_to_ngn_rate").maybeSingle(),
    ]);
    setPayments((p as Payment[]) ?? []);
    const map: Record<string, Case> = {};
    (c as Case[] | null)?.forEach((row) => (map[row.id] = row));
    setCasesById(map);
    const r = Number((bs as { usd_to_ngn_rate: number | null } | null)?.usd_to_ngn_rate);
    setRate(r > 0 ? r : null);
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

  const scoped = useMemo(() => payments.filter((p) => inRange(p, range)), [payments, range]);
  const sum = useMemo(() => summarize(scoped, rate), [scoped, rate]);
  const months = useMemo(() => monthlyIncome(payments, rate, 12), [payments, rate]);
  const byService = useMemo(
    () =>
      incomeBy(scoped, rate, (p) => {
        const t = casesById[p.case_id]?.case_type;
        return t ? { key: t, label: CASE_TYPE_LABELS[t] } : { key: "none", label: "Case removed" };
      }),
    [scoped, rate, casesById]
  );
  const byKind = useMemo(
    () => incomeBy(scoped, rate, (p) => ({ key: p.kind, label: KIND_LABELS[p.kind] ?? p.kind })),
    [scoped, rate]
  );
  const byMethod = useMemo(
    () => incomeBy(scoped, rate, (p) => ({ key: p.method ?? "other", label: METHOD_LABELS[p.method ?? "other"] })),
    [scoped, rate]
  );
  const rows = useMemo(
    () => scoped.filter((p) => statusFilter === "all" || p.status === statusFilter),
    [scoped, statusFilter]
  );

  function exportCsv() {
    const csv = toCsv([
      ["Created", "Paid on", "Case", "Description", "Type", "Method", "Currency", "Amount", "Status", "Reference"],
      ...rows.map((p) => [
        p.created_at.slice(0, 10),
        p.paid_at ? p.paid_at.slice(0, 10) : null,
        casesById[p.case_id]?.title ?? "",
        p.description,
        p.kind,
        p.method,
        p.currency,
        Number(p.amount),
        p.status,
        p.client_reference,
      ]),
    ]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `iconfam-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  const dual = (m: { usd: number; ngn: number }) => {
    const parts = [];
    if (m.usd) parts.push(fmtUsd(m.usd));
    if (m.ngn) parts.push(fmtNgn(m.ngn));
    return parts.length ? parts.join(" + ") : "Nothing";
  };
  const total = sum.counts.paid + sum.counts.pending + sum.counts.overdue + sum.counts.waived;
  const statusSplit: { key: PaymentStatus; value: number; bar: string; dot: string }[] = [
    { key: "paid", value: sum.incomeUsdEq, bar: "bg-verified", dot: "bg-verified" },
    { key: "pending", value: sum.outstandingUsdEq - sum.overdueUsdEq, bar: "bg-amber-400", dot: "bg-amber-400" },
    { key: "overdue", value: sum.overdueUsdEq, bar: "bg-red-500", dot: "bg-red-500" },
    { key: "waived", value: sum.waivedUsdEq, bar: "bg-neutral-300", dot: "bg-neutral-300" },
  ];
  const splitTotal = statusSplit.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-navy">Payments</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="range" className="sr-only">Time range</label>
          <select
            id="range"
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            className="rounded border border-line bg-white px-2 py-1.5 text-sm"
          >
            {Object.entries(RANGE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button onClick={exportCsv} className="rounded border border-line bg-white px-3 py-1.5 text-sm hover:border-stamp">
            Export CSV
          </button>
        </div>
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Income (paid)" value={fmtUsd(sum.incomeUsdEq)} tone="text-navy"
          sub={<>{dual(sum.income)} · {sum.counts.paid} invoice{sum.counts.paid === 1 ? "" : "s"}</>} />
        <Tile label="Outstanding" value={fmtUsd(sum.outstandingUsdEq)} tone="text-stamp"
          sub={<>{dual(sum.outstanding)} · {sum.counts.pending + sum.counts.overdue} unpaid</>} />
        <Tile label="Overdue" value={fmtUsd(sum.overdueUsdEq)} tone={sum.overdueUsdEq > 0 ? "text-red-600" : "text-navy"}
          sub={<>{sum.counts.overdue} invoice{sum.counts.overdue === 1 ? "" : "s"}</>} />
        <Tile label="Collected so far" value={sum.collectionRate === null ? "—" : `${Math.round(sum.collectionRate * 100)}%`}
          sub={<>of everything billed · {fmtUsd(sum.waivedUsdEq)} waived</>} />
      </section>
      {(sum.unconverted > 0 || (!rate && sum.income.ngn + sum.outstanding.ngn > 0)) && (
        <p role="note" className="-mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {sum.unconverted} naira invoice{sum.unconverted === 1 ? "" : "s"} can&apos;t be converted to dollars because no
          USD→NGN rate is set. Add one in Settings and the dollar totals will include them.
        </p>
      )}
      <p className="-mt-3 text-xs text-neutral-500">
        Dollar figures add naira invoices at the rate recorded on each invoice (or today&apos;s rate if none).
      </p>

      <section className="rounded-lg border border-line bg-white p-4" aria-label="Income by month">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Income by month (last 12 months, USD)</h2>
        <ColumnChart
          data={months.map((m) => ({ label: m.label, value: m.value }))}
          format={(n) => fmtUsd(n)}
          axisFormat={fmtUsdShort}
          valueHeader="Income"
          ariaLabel={`Monthly income for the last 12 months. Highest month ${fmtUsd(Math.max(...months.map((m) => m.value)))}.`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Breakdown">
        <div className="rounded-lg border border-line bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Where the money stands</h3>
          {splitTotal > 0 ? (
            <>
              <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img"
                aria-label={statusSplit.map((s) => `${PAYMENT_STATUS_LABELS[s.key]} ${fmtUsd(s.value)}`).join(", ")}>
                {statusSplit.filter((s) => s.value > 0).map((s) => (
                  <div key={s.key} className={s.bar} style={{ width: `${(s.value / splitTotal) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {statusSplit.map((s) => (
                  <li key={s.key} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-neutral-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} aria-hidden="true" />
                      {PAYMENT_STATUS_LABELS[s.key]} <span className="text-neutral-400">· {sum.counts[s.key]}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-navy">{fmtUsd(s.value)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between border-t border-line pt-1.5">
                  <span className="text-neutral-600">All invoices · {total}</span>
                  <span className="font-semibold tabular-nums text-navy">{fmtUsd(splitTotal)}</span>
                </li>
              </ul>
            </>
          ) : (
            <p className="text-xs text-neutral-400">No invoices in this period.</p>
          )}
        </div>
        <Bars title="Income by service" rows={byService} empty="No paid invoices in this period." />
        <Bars title="Income by payment type" rows={byKind} empty="No paid invoices in this period." />
        <Bars title="Income by how it was paid" rows={byMethod} empty="No paid invoices in this period." />
      </section>

      <section aria-label="All invoices">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy">Invoices ({rows.length})</h2>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | "all")}
            className="rounded border border-line bg-white px-2 py-1 text-sm"
          >
            <option value="all">All statuses</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
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
              {rows.map((p, i) => (
                <tr key={p.id} className={`border-t border-line ${i % 2 === 1 ? "bg-paper/40" : ""}`}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/cases/${p.case_id}`} className="text-stamp hover:underline">
                      {casesById[p.case_id]?.title ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{p.description}</td>
                  <td className="px-3 py-2 tabular-nums">{p.currency} {Number(p.amount).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2"><StatusBadge kind="payment" value={p.status} /></td>
                  <td className="px-3 py-2">
                    {p.status !== "paid" && p.status !== "waived" && (
                      <button onClick={() => markPaid(p.id)} className="rounded bg-verified px-2 py-1 text-xs font-medium text-white">
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-neutral-400">No invoices match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
