"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ReviewState } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

// The admin's "second pair of eyes" control, used for both reports and
// documents. The database (not this component) enforces that nothing reaches
// the client or the rest of the team until the status is "approved" and the
// matching share flag is on — see supabase/migrations/0005.

export default function ReviewControls({
  table,
  id,
  status,
  shareWithClient,
  shareWithTeam,
  reviewNote,
  onChanged,
}: {
  table: "reports" | "documents";
  id: string;
  status: ReviewState;
  shareWithClient: boolean;
  shareWithTeam: boolean;
  reviewNote: string | null;
  onChanged: () => void;
}) {
  // Defaults offered on approval: the client is the usual audience; sharing
  // with the rest of the case team is something the admin opts into.
  const [toClient, setToClient] = useState(true);
  const [toTeam, setToTeam] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(update: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from(table).update(update).eq("id", id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return false;
    }
    onChanged();
    return true;
  }

  async function approve() {
    await apply({
      review_status: "approved",
      review_note: null,
      share_with_client: toClient,
      share_with_team: toTeam,
    });
  }

  async function reject() {
    if (!note.trim()) {
      setError("Add a short reason — it's sent back to the person who submitted this.");
      return;
    }
    if (await apply({ review_status: "rejected", review_note: note.trim() })) {
      setRejecting(false);
      setNote("");
    }
  }

  return (
    <div className="mt-3 rounded-md border border-line bg-white p-3 text-xs">
      <div className="mb-2 flex items-center gap-2">
        <StatusBadge kind="review" value={status} />
        {status === "approved" && (
          <span className="text-neutral-500">
            Shared with:{" "}
            <strong className="font-semibold text-neutral-700">
              {[shareWithClient && "client", shareWithTeam && "case team"]
                .filter(Boolean)
                .join(" + ") || "no one yet"}
            </strong>
          </span>
        )}
      </div>

      {status === "rejected" && reviewNote && (
        <p className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-700">
          <span className="font-semibold">Reason sent back: </span>
          {reviewNote}
        </p>
      )}

      {status === "pending" && !rejecting && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-1.5 text-neutral-600">
            <input type="checkbox" checked={toClient} onChange={(e) => setToClient(e.target.checked)} />
            Share with client
          </label>
          <label className="flex items-center gap-1.5 text-neutral-600">
            <input type="checkbox" checked={toTeam} onChange={(e) => setToTeam(e.target.checked)} />
            Share with case team
          </label>
          <div className="ml-auto flex gap-2">
            <button
              onClick={approve}
              disabled={busy}
              className="rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              onClick={() => {
                setRejecting(true);
                setError(null);
              }}
              disabled={busy}
              className="rounded border border-red-300 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Reject…
            </button>
          </div>
        </div>
      )}

      {status === "pending" && rejecting && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Why is this being rejected? (sent back to the submitter)"
            className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={reject}
              disabled={busy}
              className="rounded bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              Confirm rejection
            </button>
            <button
              onClick={() => {
                setRejecting(false);
                setError(null);
              }}
              className="rounded border border-line px-3 py-1.5 text-neutral-600 hover:bg-paper"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === "approved" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-1.5 text-neutral-600">
            <input
              type="checkbox"
              checked={shareWithClient}
              disabled={busy}
              onChange={(e) => apply({ share_with_client: e.target.checked })}
            />
            Client
          </label>
          <label className="flex items-center gap-1.5 text-neutral-600">
            <input
              type="checkbox"
              checked={shareWithTeam}
              disabled={busy}
              onChange={(e) => apply({ share_with_team: e.target.checked })}
            />
            Case team
          </label>
          <button
            onClick={() => apply({ review_status: "pending" })}
            disabled={busy}
            className="ml-auto rounded border border-line px-3 py-1.5 text-neutral-600 hover:bg-paper disabled:opacity-60"
          >
            Withdraw approval
          </button>
        </div>
      )}

      {status === "rejected" && (
        <button
          onClick={() => apply({ review_status: "pending" })}
          disabled={busy}
          className="rounded border border-line px-3 py-1.5 text-neutral-600 hover:bg-paper disabled:opacity-60"
        >
          Reopen for review
        </button>
      )}

      {error && (
        <p className="mt-2 text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
