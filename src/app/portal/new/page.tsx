"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { CaseType } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import BackLink from "@/components/BackLink";
import { CASE_TYPE_IMAGE } from "@/lib/caseVisuals";
import { CheckIcon } from "@/components/portal/icons";

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

  const field =
    "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy shadow-sm transition placeholder:text-neutral-400 focus:border-stamp focus:outline-none focus:ring-2 focus:ring-stamp/25";

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/portal">My cases</BackLink>
      <h1 className="font-display text-3xl font-bold tracking-tight text-navy">Request verification</h1>
      <p className="mt-2 max-w-prose leading-relaxed text-neutral-600">
        Tell us what you need checked. We&apos;ll follow up with the specifics and a fee before
        anything starts — you&apos;re never charged automatically.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-navy">What do you need verified?</legend>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(Object.entries(CASE_TYPE_LABELS) as [CaseType, string][]).map(([value, label]) => {
              const selected = caseType === value;
              return (
                <label
                  key={value}
                  className={`group relative block cursor-pointer overflow-hidden rounded-2xl border-2 bg-footerBg transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-stamp ${
                    selected ? "border-stamp shadow-md" : "border-transparent hover:shadow-md"
                  }`}
                >
                  <input
                    type="radio"
                    name="case-type"
                    value={value}
                    checked={selected}
                    onChange={() => setCaseType(value)}
                    className="sr-only"
                  />
                  <div className="relative h-28 sm:h-32">
                    <Image
                      src={CASE_TYPE_IMAGE[value].src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 12rem, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-footerBg via-footerBg/50 to-transparent" />
                    {selected && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-stamp text-white shadow">
                        <CheckIcon size={14} />
                      </span>
                    )}
                  </div>
                  <span className="block px-3 pb-3 pt-1 text-sm font-semibold leading-snug text-white">
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-5 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div>
            <label htmlFor="req-title" className="mb-1.5 block text-sm font-medium text-navy">
              Short description
            </label>
            <input
              id="req-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Land purchase in Ikorodu, Lagos"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="req-details" className="mb-1.5 block text-sm font-medium text-navy">
              Anything else we should know? (optional)
            </label>
            <textarea
              id="req-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="e.g. The paperwork has been pending for 6 months and I want to confirm it's actually moving."
              className={field}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stamp px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-stampDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "Sending…" : "Send request"}
          </button>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-navy">What happens next</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["We review your request", "A verification lead reads it and may ask a few questions."],
            ["You get a scope and fee", "Nothing starts, and nothing is charged, until you agree."],
            ["Our team verifies on the ground", "You follow every step, photo and report right here."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-2xl border border-line bg-white/70 p-4">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-navy">{t}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
