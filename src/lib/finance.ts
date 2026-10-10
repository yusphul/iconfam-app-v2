import type { CaseType, Payment } from "@/lib/types";

// Money maths for the admin Payments page. Kept free of React so it can be tested.
//
//   income      = invoices with status "paid"
//   outstanding = "pending" + "overdue"
//   waived      = written off; never counted as income
//
// Invoices are in USD or NGN. For one combined figure, NGN is converted to USD
// at the rate recorded on the invoice (fx_rate) or, failing that, today's rate.

export interface Money {
  usd: number;
  ngn: number;
}
export const zero = (): Money => ({ usd: 0, ngn: 0 });

export function usdValue(p: Pick<Payment, "amount" | "currency" | "fx_rate">, rate: number | null): number | null {
  const amount = Number(p.amount);
  if (p.currency === "USD") return amount;
  const r = Number(p.fx_rate) > 0 ? Number(p.fx_rate) : rate && rate > 0 ? rate : null;
  return r ? amount / r : null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export type Range = "all" | "month" | "90d" | "year";
export const RANGE_LABELS: Record<Range, string> = {
  all: "All time",
  month: "This month",
  "90d": "Last 90 days",
  year: "This year",
};

/** The date an invoice "belongs" to: when it was paid, else when it was raised. */
export const effectiveDate = (p: Pick<Payment, "paid_at" | "created_at" | "status">) =>
  new Date(p.status === "paid" && p.paid_at ? p.paid_at : p.created_at);

export function inRange(p: Pick<Payment, "paid_at" | "created_at" | "status">, range: Range, now = new Date()): boolean {
  if (range === "all") return true;
  const d = effectiveDate(p);
  if (range === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (range === "year") return d.getFullYear() === now.getFullYear();
  return now.getTime() - d.getTime() <= 90 * 24 * 3600 * 1000;
}

export interface Summary {
  income: Money;
  outstanding: Money;
  overdue: Money;
  waived: Money;
  incomeUsdEq: number;
  outstandingUsdEq: number;
  overdueUsdEq: number;
  waivedUsdEq: number;
  /** invoices that could not be converted to USD (NGN with no rate available) */
  unconverted: number;
  collectionRate: number | null; // paid / (paid + outstanding), 0..1
  counts: { paid: number; pending: number; overdue: number; waived: number };
}

export function summarize(payments: Payment[], rate: number | null): Summary {
  const s: Summary = {
    income: zero(), outstanding: zero(), overdue: zero(), waived: zero(),
    incomeUsdEq: 0, outstandingUsdEq: 0, overdueUsdEq: 0, waivedUsdEq: 0,
    unconverted: 0, collectionRate: null,
    counts: { paid: 0, pending: 0, overdue: 0, waived: 0 },
  };
  for (const p of payments) {
    const amt = Number(p.amount);
    const key = p.currency === "NGN" ? "ngn" : "usd";
    const usd = usdValue(p, rate);
    if (usd === null) s.unconverted++;
    const u = usd ?? 0;
    s.counts[p.status]++;
    if (p.status === "paid") { s.income[key] += amt; s.incomeUsdEq += u; }
    else if (p.status === "waived") { s.waived[key] += amt; s.waivedUsdEq += u; }
    else {
      s.outstanding[key] += amt; s.outstandingUsdEq += u;
      if (p.status === "overdue") { s.overdue[key] += amt; s.overdueUsdEq += u; }
    }
  }
  s.incomeUsdEq = r2(s.incomeUsdEq);
  s.outstandingUsdEq = r2(s.outstandingUsdEq);
  s.overdueUsdEq = r2(s.overdueUsdEq);
  s.waivedUsdEq = r2(s.waivedUsdEq);
  const billed = s.incomeUsdEq + s.outstandingUsdEq;
  s.collectionRate = billed > 0 ? s.incomeUsdEq / billed : null;
  return s;
}

export interface MonthPoint {
  key: string; // YYYY-MM
  label: string; // "Oct 25"
  value: number; // USD-equivalent income
}

/** Income per calendar month for the last `months` months, oldest first, zeros included. */
export function monthlyIncome(payments: Payment[], rate: number | null, months = 12, now = new Date()): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      value: 0,
    });
  }
  const idx = new Map(out.map((m, i) => [m.key, i]));
  for (const p of payments) {
    if (p.status !== "paid" || !p.paid_at) continue;
    const d = new Date(p.paid_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const i = idx.get(k);
    const u = usdValue(p, rate);
    if (i !== undefined && u !== null) out[i].value += u;
  }
  out.forEach((m) => (m.value = r2(m.value)));
  return out;
}

export interface Slice {
  key: string;
  label: string;
  value: number; // USD-equivalent income
  count: number;
}

/** Paid income grouped by any key, biggest first. */
export function incomeBy(payments: Payment[], rate: number | null, keyOf: (p: Payment) => { key: string; label: string }): Slice[] {
  const map = new Map<string, Slice>();
  for (const p of payments) {
    if (p.status !== "paid") continue;
    const u = usdValue(p, rate);
    if (u === null) continue;
    const { key, label } = keyOf(p);
    const cur = map.get(key) ?? { key, label, value: 0, count: 0 };
    cur.value += u;
    cur.count++;
    map.set(key, cur);
  }
  return [...map.values()].map((s) => ({ ...s, value: r2(s.value) })).sort((a, b) => b.value - a.value);
}

export const caseTypeOf = (casesById: Record<string, { case_type: CaseType }>, p: Payment): CaseType | null =>
  casesById[p.case_id]?.case_type ?? null;

export function toCsv(rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

export const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export const fmtNgn = (n: number) =>
  "₦" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
export const fmtUsdShort = (n: number) =>
  n >= 1000 ? `$${+(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;
