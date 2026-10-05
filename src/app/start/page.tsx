"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import LeadForm, { JOURNEY_STEPS } from "@/components/journey/LeadForm";

// Public entry point: no account needed to show interest.
export default function StartPage() {
  return (
    <div className="min-h-screen bg-paper bg-[radial-gradient(60rem_26rem_at_50%_-8rem,#EAF0F6,transparent)] font-body">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="iConfam home" className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stamp">
          <Logo height={28} />
        </Link>
        <Link href="/login?role=client" className="text-sm font-medium text-stamp hover:underline">
          Sign in
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Verify before your money moves
        </h1>
        <p className="mt-3 max-w-prose leading-relaxed text-neutral-600">
          Tell us what you&apos;re trying to do in Nigeria. We&apos;ll book a short call to understand
          your situation, then send you a fixed-fee plan. You&apos;re never charged before you agree.
        </p>
        <div className="mt-8">
          <LeadForm />
        </div>
        <section className="mt-12">
          <h2 className="font-display text-lg font-semibold text-navy">How it works</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {JOURNEY_STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3 rounded-2xl border border-line bg-white/70 p-4">
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
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
      </main>
    </div>
  );
}
