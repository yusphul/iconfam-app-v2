"use client";

import { invoiceLabel, isFullPayment } from "@/lib/paymentWording";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Payment } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

export interface PaymentInstructions {
  bank_usd: string | null;
  bank_ngn: string | null;
  usd_to_ngn_rate: number | null;
}

const CARD_ENABLED = process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";
const money = (cur: string, n: number) => `${cur} ${Number(n).toLocaleString()}`;

// The client's invoices, with the ways to pay each open one.
export default function PaymentPanel({
  payments,
  instructions,
  openId,
  onOpen,
  onChanged,
}: {
  payments: Payment[];
  instructions: PaymentInstructions | null;
  openId: string | null;
  onOpen: (id: string | null) => void;
  onChanged: () => void;
}) {
  if (payments.length === 0) {
    return <p className="text-sm text-neutral-500">No fees on this case yet.</p>;
  }
  const full = isFullPayment(payments);
  const depositOutstanding = payments.some(
    (p) => p.kind === "deposit" && p.status !== "paid" && p.status !== "waived"
  );
  return (
    <ul className="space-y-3">
      {payments.map((p) => {
        const open = p.status === "pending" || p.status === "overdue";
        const waitingForDeposit = open && p.kind === "balance" && depositOutstanding;
        return (
          <li key={p.id} className="rounded-xl border border-line bg-paper/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-neutral-700">{invoiceLabel(p, full)}</p>
                <p className="font-display text-lg font-semibold tabular-nums text-navy">
                  {money(p.currency, p.amount)}
                </p>
              </div>
              <StatusBadge kind="payment" value={p.status} />
            </div>

            {waitingForDeposit ? (
              <p className="mt-2 text-sm text-neutral-500">Due after your deposit is confirmed.</p>
            ) : open && p.reported_at ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Thanks. We&apos;re confirming your transfer (reference <b>{p.client_reference}</b>). This
                usually takes one business day.
              </p>
            ) : open ? (
              openId === p.id ? (
                <PayOptions payment={p} instructions={instructions} onDone={onChanged} onClose={() => onOpen(null)} />
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="mt-3 rounded-full bg-stamp px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-stampDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
                >
                  {p.kind === "deposit" && !full ? "Pay deposit" : "Pay now"}
                </button>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

type Tab = "card" | "bank_usd" | "bank_ngn";

function PayOptions({
  payment,
  instructions,
  onDone,
  onClose,
}: {
  payment: Payment;
  instructions: PaymentInstructions | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const isUsd = payment.currency === "USD";
  const rate = instructions?.usd_to_ngn_rate ?? null;
  const tabs: { key: Tab; label: string }[] = [];
  if (isUsd && CARD_ENABLED) tabs.push({ key: "card", label: "Card" });
  if (isUsd) tabs.push({ key: "bank_usd", label: "Bank transfer (USD)" });
  if ((isUsd && rate) || payment.currency === "NGN") tabs.push({ key: "bank_ngn", label: "Bank transfer (naira)" });

  const [tab, setTab] = useState<Tab | null>(tabs[0]?.key ?? null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ngnAmount = isUsd && rate ? Math.round(Number(payment.amount) * rate) : Number(payment.amount);

  async function payByCard() {
    setBusy(true);
    setError(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token}` },
      body: JSON.stringify({ paymentId: payment.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) {
      setError(json.error ?? "We couldn't start the card payment.");
      setBusy(false);
      return;
    }
    window.location.href = json.url;
  }

  async function reportTransfer() {
    if (!tab || tab === "card") return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("report_payment", {
      p_payment: payment.id,
      p_method: tab,
      p_reference: reference,
    });
    setBusy(false);
    if (err) {
      setError(
        err.message.includes("invalid_reference")
          ? "Enter the reference from your bank transfer (at least 3 characters)."
          : "We couldn't record that. Please try again."
      );
      return;
    }
    onDone();
  }

  if (tabs.length === 0) {
    return <p className="mt-3 text-sm text-neutral-600">Payment details aren&apos;t available yet. We&apos;ll be in touch.</p>;
  }

  const details = tab === "bank_usd" ? instructions?.bank_usd : tab === "bank_ngn" ? instructions?.bank_ngn : null;

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <div role="tablist" aria-label="Payment method" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              tab === t.key ? "border-navy bg-navy text-white" : "border-line bg-white text-neutral-700 hover:border-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "card" && (
        <button
          type="button"
          onClick={payByCard}
          disabled={busy}
          className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Opening…" : `Pay ${money("USD", payment.amount)} by card`}
        </button>
      )}

      {(tab === "bank_usd" || tab === "bank_ngn") && (
        <div className="space-y-3 text-sm">
          <p className="text-neutral-700">
            Send{" "}
            <b>{tab === "bank_ngn" ? money("NGN", ngnAmount) : money(payment.currency, payment.amount)}</b>
            {tab === "bank_ngn" && isUsd && rate && (
              <span className="text-neutral-500"> (at ₦{rate.toLocaleString()} per $1, fixed when you confirm)</span>
            )}{" "}
            to:
          </p>
          <pre className="whitespace-pre-wrap rounded-lg border border-line bg-white p-3 font-body text-sm text-navy">
            {details || "Bank details are being set up. Please contact us and we'll send them."}
          </pre>
          <div>
            <label htmlFor={`ref-${payment.id}`} className="mb-1 block text-xs font-medium text-neutral-600">
              After sending, enter your transfer reference
            </label>
            <input
              id={`ref-${payment.id}`}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. the reference or transaction ID from your bank"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-stamp focus:outline-none focus:ring-2 focus:ring-stamp/25"
            />
          </div>
          <button
            type="button"
            onClick={reportTransfer}
            disabled={busy || reference.trim().length < 3 || !details}
            className="rounded-full bg-stamp px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "I've sent the payment"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="button" onClick={onClose} className="text-xs text-neutral-500 hover:underline">
        Close
      </button>
    </div>
  );
}

export function depositState(payments: Payment[]): "none" | "due" | "reported" | "paid" {
  const d = payments.find((p) => p.kind === "deposit");
  if (!d) return "none";
  if (d.status === "paid" || d.status === "waived") return "paid";
  return d.reported_at ? "reported" : "due";
}
