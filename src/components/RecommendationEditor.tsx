"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { CaseRecommendation, RecommendationVerdict } from "@/lib/types";
import { VERDICT_LABELS } from "@/lib/types";
import { detectContactInfo, timeAgo } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";

// The admin writes iConfam's recommendation for a case here. It stays a draft,
// invisible to the client, until published (the database enforces this too).
// Professionals and field agents can never read it.

export default function RecommendationEditor({ caseId }: { caseId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<CaseRecommendation | null>(null);
  const [verdict, setVerdict] = useState<RecommendationVerdict | "">("");
  const [summary, setSummary] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("case_recommendations")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();
    const row = (data as CaseRecommendation | null) ?? null;
    setSaved(row);
    setVerdict(row?.verdict ?? "");
    setSummary(row?.summary ?? "");
    setNextSteps(row?.next_steps ?? "");
    setLoaded(true);
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(publish: boolean) {
    setError(null);
    setNotice(null);
    if (!verdict) {
      setError("Choose a verdict first.");
      return;
    }
    if (!summary.trim()) {
      setError("Write a short summary — it's the part the client reads first.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.from("case_recommendations").upsert(
      {
        case_id: caseId,
        verdict,
        summary: summary.trim(),
        next_steps: nextSteps.trim() || null,
        published: publish,
      },
      { onConflict: "case_id" }
    );
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNotice(
      publish
        ? saved?.published
          ? "Changes saved — the client sees the updated version."
          : "Published — the client can now see it."
        : saved?.published
          ? "Moved back to draft — hidden from the client."
          : "Draft saved. The client can't see it yet."
    );
    load();
  }

  if (!loaded) return <p className="text-sm text-neutral-400">Loading…</p>;

  const live = saved?.published ?? false;
  const dirty =
    (saved?.verdict ?? "") !== verdict ||
    (saved?.summary ?? "") !== summary.trim() ||
    (saved?.next_steps ?? "") !== nextSteps.trim();
  const warn = detectContactInfo(`${summary}\n${nextSteps}`);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {saved ? (
          <StatusBadge
            kind="review"
            value={live ? "approved" : "pending"}
            label={live ? "Published to client" : "Draft — not visible to client"}
          />
        ) : (
          <StatusBadge kind="review" value="pending" label="Not written yet" />
        )}
        {saved && (
          <span className="text-xs text-neutral-400">Last saved {timeAgo(saved.updated_at)}</span>
        )}
      </div>

      <div>
        <label htmlFor="rec-verdict" className="mb-1 block text-xs font-medium text-neutral-500">
          Verdict
        </label>
        <select
          id="rec-verdict"
          value={verdict}
          onChange={(e) => setVerdict(e.target.value as RecommendationVerdict | "")}
          className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm sm:w-auto"
        >
          <option value="">Select a verdict…</option>
          {Object.entries(VERDICT_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {verdict && (
          <span className="ml-2 align-middle">
            <StatusBadge kind="verdict" value={verdict} />
          </span>
        )}
      </div>

      <div>
        <label htmlFor="rec-summary" className="mb-1 block text-xs font-medium text-neutral-500">
          Summary (plain language, written for the client)
        </label>
        <textarea
          id="rec-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={5}
          placeholder="What we checked, what we found, and what it means for their decision."
          className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="rec-next" className="mb-1 block text-xs font-medium text-neutral-500">
          Recommended next steps (optional)
        </label>
        <textarea
          id="rec-next"
          value={nextSteps}
          onChange={(e) => setNextSteps(e.target.value)}
          rows={3}
          placeholder={"1. …\n2. …"}
          className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
        />
      </div>

      {warn.length > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          ⚠ This text may contain contact details ({warn.join(", ")}). Check before publishing.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {live ? (
          <>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={busy || !dirty}
              className="rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => save(false)}
              disabled={busy}
              className="rounded border border-line px-4 py-2 text-sm text-neutral-600 hover:bg-paper disabled:opacity-60"
            >
              Unpublish
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={busy}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Publish to client
            </button>
            <button
              type="button"
              onClick={() => save(false)}
              disabled={busy || (!dirty && !!saved)}
              className="rounded border border-line px-4 py-2 text-sm text-neutral-600 hover:bg-paper disabled:opacity-40"
            >
              Save draft
            </button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
    </div>
  );
}
