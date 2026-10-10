"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { collectCaseFiles, removeCaseFiles } from "@/lib/storageCleanup";
import { fmtNgn, fmtUsd } from "@/lib/finance";

// Confirm-and-delete for a case that is no longer needed. The admin has to type
// DELETE, and a case with paid invoices gets an extra warning because deleting
// it also removes that income from the Payments totals.
export default function DeleteCaseDialog({
  caseId,
  title,
  onClose,
  onDeleted,
}: {
  caseId: string;
  title: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [paid, setPaid] = useState<{ count: number; usd: number; ngn: number } | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("payments")
      .select("amount, currency, status")
      .eq("case_id", caseId)
      .eq("status", "paid")
      .then(({ data }) => {
        const rows = (data as { amount: number; currency: string }[]) ?? [];
        setPaid({
          count: rows.length,
          usd: rows.filter((r) => r.currency !== "NGN").reduce((s, r) => s + Number(r.amount), 0),
          ngn: rows.filter((r) => r.currency === "NGN").reduce((s, r) => s + Number(r.amount), 0),
        });
      });
    inputRef.current?.focus();
  }, [caseId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const files = await collectCaseFiles(caseId);
      const { error: rpcError } = await supabase.rpc("delete_case", {
        p_case: caseId,
        p_force: (paid?.count ?? 0) > 0,
      });
      if (rpcError) {
        throw new Error(
          /has_paid_payments/.test(rpcError.message)
            ? "This case has paid invoices. Reload and try again."
            : rpcError.message
        );
      }
      const failed = await removeCaseFiles(files);
      if (failed > 0) console.warn(`${failed} stored file(s) could not be removed.`);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the case.");
      setBusy(false);
    }
  }

  const hasPaid = (paid?.count ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && onClose()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="del-title"
        aria-describedby="del-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 id="del-title" className="font-display text-lg font-bold text-navy">Delete this case?</h2>
        <p id="del-desc" className="mt-2 text-sm text-neutral-600">
          <span className="font-semibold text-navy">{title}</span> and everything attached to it will be removed for good:
          steps, field reports, photos and videos, documents, invoices, messages and notes. This can&apos;t be undone.
        </p>
        {hasPaid && (
          <p role="alert" className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This case has {paid!.count} paid invoice{paid!.count === 1 ? "" : "s"} (
            {[paid!.usd ? fmtUsd(paid!.usd) : "", paid!.ngn ? fmtNgn(paid!.ngn) : ""].filter(Boolean).join(" + ")}).
            Deleting it also removes that money from your income totals. If you only want it out of the way, close it and archive it instead.
          </p>
        )}
        <label htmlFor="del-confirm" className="mt-4 block text-sm text-neutral-600">
          Type <span className="font-mono font-semibold text-navy">DELETE</span> to confirm
        </label>
        <input
          id="del-confirm"
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-sm"
        />
        {error && <p role="alert" className="mt-2 text-sm text-stamp">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded border border-line px-4 py-2 text-sm">
            Keep case
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busy || typed.trim() !== "DELETE" || paid === null}
            className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Deleting…" : "Delete case"}
          </button>
        </div>
      </div>
    </div>
  );
}
