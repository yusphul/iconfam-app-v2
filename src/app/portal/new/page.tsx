"use client";

import { useAuth } from "@/lib/AuthProvider";
import BackLink from "@/components/BackLink";
import LeadForm, { JOURNEY_STEPS } from "@/components/journey/LeadForm";

export default function RequestVerificationPage() {
  const { profile, session } = useAuth();

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/portal">My cases</BackLink>
      <h1 className="font-display text-3xl font-bold tracking-tight text-navy">Request verification</h1>
      <p className="mt-2 max-w-prose leading-relaxed text-neutral-600">
        Tell us what you need checked. We&apos;ll set up a short call to understand where you are,
        then send a fixed fee. Nothing starts, and nothing is charged, until you agree.
      </p>

      <div className="mt-8">
        {profile && (
          <LeadForm
            initialName={profile.full_name ?? ""}
            initialEmail={profile.email ?? session?.user.email ?? ""}
            lockEmail
          />
        )}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-navy">What happens next</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY_STEPS.map(([t, d], i) => (
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
