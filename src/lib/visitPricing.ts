// Visit-based pricing for site inspection and farm oversight:
//
//   price = iConfam service fee + field costs (agent wage + transport + data)
//
// Field costs are kept in naira (that's what the agents are paid in) and shown
// to the client in US dollars at the app's naira rate. Every line is rounded to
// cents first and the total is the sum of the rounded lines, so the lines the
// client sees always add up exactly.

import type { CaseType } from "@/lib/types";

export type VisitZone = {
  code: string;
  label: string;
  wage_ngn: number;
  transport_ngn: number;
  data_ngn: number;
  sort_order: number;
};

export type QuoteLine = { label: string; amount: number };

/** Services priced per visit. Everything else is quoted by hand after the call. */
export const VISIT_SERVICES: CaseType[] = ["ground_up_build", "farm_oversight"];

export function isVisitService(service: CaseType): boolean {
  return VISIT_SERVICES.includes(service);
}

export const MAX_VISITS = 60;

const cents = (n: number) => Math.round(n * 100) / 100;

export function fieldCostNgn(zone: VisitZone): number {
  return zone.wage_ngn + zone.transport_ngn + zone.data_ngn;
}

function visitsText(visits: number) {
  return `${visits} ${visits === 1 ? "visit" : "visits"}`;
}

export type VisitQuote = { lines: QuoteLine[]; total: number; perVisit: number };

/**
 * Builds the itemised USD quote. Returns null when the inputs can't make a
 * valid quote (no zone, a visit count that isn't a whole number from 1 to 60,
 * or no naira rate).
 */
export function buildVisitQuote(input: {
  visits: number;
  zone: VisitZone | null | undefined;
  feeUsd: number;
  rate: number | null | undefined;
}): VisitQuote | null {
  const { visits, zone, feeUsd, rate } = input;
  if (!zone || !rate || !(rate > 0)) return null;
  if (!Number.isInteger(visits) || visits < 1 || visits > MAX_VISITS) return null;
  if (!(feeUsd >= 0)) return null;

  const usd = (ngn: number) => cents((ngn * visits) / rate);
  const candidates: QuoteLine[] = [
    { label: `iConfam service fee (${visitsText(visits)} × USD ${cents(feeUsd).toFixed(2)})`, amount: cents(feeUsd * visits) },
    { label: `Field agent wage (${visitsText(visits)})`, amount: usd(zone.wage_ngn) },
    { label: `Agent transport (${visitsText(visits)})`, amount: usd(zone.transport_ngn) },
    { label: `Mobile data for reporting (${visitsText(visits)})`, amount: usd(zone.data_ngn) },
  ];
  const lines = candidates.filter((l) => l.amount > 0);
  if (lines.length === 0) return null;
  const total = cents(lines.reduce((s, l) => s + l.amount, 0));
  return { lines, total, perVisit: cents(total / visits) };
}
