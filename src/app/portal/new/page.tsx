"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { CaseType } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";

export default function RequestVerificationPage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [caseType, setCaseType] = useState<CaseType>("property_purchase");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setSubmitting(true);

    const { data, error: insertError } = await supabase
      .from("cases")
      .insert({
        client_id: profile.id,
        case_type: caseType,
        title,
        location_description: details || null,
        status: "intake",
      })
      .select()
      .single();

    setSubmitting(false);
    if (insertError || !data) {
      setError(insertError?.message ?? "Something went wrong — please try again.");
      return;
    }
    router.replace(`/portal/cases/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 font-display text-xl font-bold text-navy">Request verification</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Tell us what you need checked. We&apos;ll follow up with the specifics and a
        fee before anything starts — you&apos;re never charged automatically.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-white p-6">
        <div>
          <label htmlFor="req-type" className="mb-1 block text-sm font-medium text-neutral-600">
            What do you need verified?
          </label>
          <select
            id="req-type"
            value={caseType}
            onChange={(e) => setCaseType(e.target.value as CaseType)}
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          >
            {Object.entries(CASE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="req-title" className="mb-1 block text-sm font-medium text-neutral-600">
            Short description
          </label>
          <input
            id="req-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Land purchase in Ikorodu, Lagos"
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="req-details" className="mb-1 block text-sm font-medium text-neutral-600">
            Anything else we should know? (optional)
          </label>
          <textarea
            id="req-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            placeholder="e.g. The paperwork has been pending for 6 months and I want to confirm it's actually moving."
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-stamp">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-navy py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send request"}
        </button>
      </form>
    </div>
  );
}
