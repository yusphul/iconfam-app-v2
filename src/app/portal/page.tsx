"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { Case, Lead, Milestone, PaymentStatus, RecommendationVerdict } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import { statusStyle } from "@/lib/statusStyles";
import { CASE_TYPE_IMAGE, firstName, greeting } from "@/lib/caseVisuals";
import { timeAgo } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import Skeleton from "@/components/portal/Skeleton";
import { AlertIcon, ArrowRightIcon, PinIcon, PlusIcon } from "@/components/portal/icons";

type StepRow = Pick<Milestone, "id" | "case_id" | "status">;

export default function ClientCasesPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [feesDue, setFeesDue] = useState<Set<string>>(new Set());
  const [verdicts, setVerdicts] = useState<Record<string, RecommendationVerdict>>({});
  const [requests, setRequests] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      // Requests that haven't become a case yet (waiting for the intake call or a quote).
      const { data: leadRows } = await supabase
        .from("leads")
        .select("*")
        .eq("client_id", profile!.id)
        .in("stage", ["new", "call_booked", "call_done"])
        .order("created_at", { ascending: false });
      setRequests((leadRows as Lead[]) ?? []);

      const { data } = await supabase
        .from("cases")
        .select("*")
        .eq("client_id", profile!.id)
        .order("updated_at", { ascending: false });
      const caseList = (data as Case[]) ?? [];
      setCases(caseList);

      if (caseList.length > 0) {
        const caseIds = caseList.map((c) => c.id);
        const [{ data: ms }, { data: pay }, { data: recs }] = await Promise.all([
          supabase.from("milestones").select("id, case_id, status").in("case_id", caseIds),
          supabase.from("payments").select("case_id, status").in("case_id", caseIds),
          // Only published recommendations come back for a client.
          supabase.from("case_recommendations").select("case_id, verdict").in("case_id", caseIds),
        ]);
        const stepRows = (ms as StepRow[]) ?? [];
        setSteps(stepRows);

        setFeesDue(
          new Set(
            ((pay as { case_id: string; status: PaymentStatus }[]) ?? [])
              .filter((p) => p.status === "pending" || p.status === "overdue")
              .map((p) => p.case_id)
          )
        );
        const v: Record<string, RecommendationVerdict> = {};
        ((recs as { case_id: string; verdict: RecommendationVerdict }[]) ?? []).forEach(
          (r) => (v[r.case_id] = r.verdict)
        );
        setVerdicts(v);

        if (stepRows.length > 0) {
          // Only approved-and-shared reports are visible to a client.
          const { count } = await supabase
            .from("reports")
            .select("id", { count: "exact", head: true })
            .in(
              "milestone_id",
              stepRows.map((s) => s.id)
            );
          setReportCount(count ?? 0);
        }
      }
      setLoading(false);
    }
    load();
  }, [profile]);

  const stepsByCase = useMemo(() => {
    const m: Record<string, StepRow[]> = {};
    steps.forEach((s) => (m[s.case_id] ??= []).push(s));
    return m;
  }, [steps]);

  if (loading) return <HomeSkeleton />;

  const activeCount = cases.filter(
    (c) => c.status !== "closed" && c.status !== "report_delivered"
  ).length;
  const verified = steps.filter((s) => s.status === "confirmed").length;
  const issues = steps.filter((s) => s.status === "issue_found").length;
  const name = firstName(profile?.full_name);

  const lead =
    cases.length === 0
      ? "Tell us what you want checked, and we'll send someone to look on the ground for you."
      : issues > 0
        ? `${issues} finding${issues === 1 ? "" : "s"} flagged. Open the case to see what we found and what we recommend.`
        : activeCount > 0
          ? "Your verifications are moving. Here is where everything stands."
          : "All your verifications are complete. Your reports stay here whenever you need them.";

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-xl">
          <h1 className="font-display text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            {greeting()}
            {name ? `, ${name}` : ""}.
          </h1>
          <p className="mt-2 text-base leading-relaxed text-neutral-600">{lead}</p>
        </div>
        <Link
          href="/portal/new"
          className="inline-flex items-center gap-2 rounded-full bg-stamp px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stampDark hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
        >
          <PlusIcon size={16} />
          Request verification
        </Link>
      </section>

      {cases.length > 0 && (
        <section aria-label="Your verification at a glance">
          {/* One joined strip rather than four separate cards: hairlines come
              from a 1px gap over a tinted background. */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-sm sm:grid-cols-4">
            <Stat label="Active cases" value={activeCount} note={`of ${cases.length} total`} />
            <Stat
              label="Steps verified"
              value={verified}
              note={steps.length ? `of ${steps.length}` : "none set up yet"}
              meter={steps.length ? verified / steps.length : undefined}
            />
            <Stat
              label="Reports received"
              value={reportCount}
              note={reportCount === 1 ? "report" : "reports"}
            />
            <Stat
              label="Issues flagged"
              value={issues}
              note={issues > 0 ? "need your attention" : "all clear"}
              tone={issues > 0 ? "alert" : "calm"}
            />
          </dl>
        </section>
      )}

      {requests.length > 0 && (
        <section aria-labelledby="requests-heading">
          <h2 id="requests-heading" className="mb-4 font-display text-xl font-semibold text-navy">
            Your requests
            <span className="ml-2 text-base font-medium text-neutral-400">{requests.length}</span>
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {requests.map((l) => (
              <li key={l.id}>
                <RequestCard lead={l} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {cases.length > 0 ? (
        <section aria-labelledby="cases-heading">
          <h2 id="cases-heading" className="mb-4 font-display text-xl font-semibold text-navy">
            My cases
            <span className="ml-2 text-base font-medium text-neutral-400">{cases.length}</span>
          </h2>
          <ul className="grid gap-5 md:grid-cols-2">
            {cases.map((c) => (
              <li key={c.id}>
                <CaseTile
                  c={c}
                  steps={stepsByCase[c.id] ?? []}
                  feeDue={feesDue.has(c.id)}
                  verdict={verdicts[c.id]}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : requests.length === 0 ? (
        <EmptyState />
      ) : null}
    </div>
  );
}

function RequestCard({ lead }: { lead: Lead }) {
  const img = CASE_TYPE_IMAGE[lead.service];
  const when = lead.call_at
    ? new Date(lead.call_at).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  return (
    <article className="flex gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="relative hidden h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-footerBg sm:block">
        <Image src={img.src} alt="" fill sizes="80px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-neutral-500">{CASE_TYPE_LABELS[lead.service]}</p>
        <h3 className="line-clamp-2 font-display text-base font-semibold text-navy">{lead.summary}</h3>
        {lead.stage === "new" && (
          <>
            <p className="mt-1 text-sm text-neutral-600">Next step: pick a time for a short call.</p>
            <Link
              href={`/book/${lead.token}`}
              className="mt-2 inline-flex items-center rounded-full bg-stamp px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-stampDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
            >
              Book your call
            </Link>
          </>
        )}
        {lead.stage === "call_booked" && (
          <>
            <p className="mt-1 text-sm text-neutral-700">
              Call booked: <span className="font-semibold text-navy">{when}</span> · {lead.call_minutes} min
            </p>
            <Link href={`/book/${lead.token}`} className="mt-1 inline-block text-sm font-medium text-stamp hover:underline">
              Join details or change time
            </Link>
          </>
        )}
        {lead.stage === "call_done" && (
          <p className="mt-1 text-sm text-neutral-600">
            Thanks for talking with us. We&apos;re preparing your scope and fee.
          </p>
        )}
      </div>
    </article>
  );
}

function Stat({
  label,
  value,
  note,
  meter,
  tone = "calm",
}: {
  label: string;
  value: number;
  note: string;
  /** 0–1: draws a thin bar under the figure. */
  meter?: number;
  tone?: "calm" | "alert";
}) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-2">
        <span
          className={`font-display text-3xl font-bold tabular-nums ${
            tone === "alert" ? "text-red-600" : "text-navy"
          }`}
        >
          {value}
        </span>
        <span className="flex items-center gap-1 text-xs text-neutral-400">
          {tone === "alert" && <AlertIcon size={12} className="text-red-500" />}
          {note}
        </span>
      </dd>
      {meter !== undefined && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div
            className="h-full rounded-full bg-verified"
            style={{ width: `${Math.round(meter * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function CaseTile({
  c,
  steps,
  feeDue,
  verdict,
}: {
  c: Case;
  steps: StepRow[];
  feeDue: boolean;
  verdict?: RecommendationVerdict;
}) {
  const img = CASE_TYPE_IMAGE[c.case_type];
  const done = steps.filter((s) => s.status === "confirmed").length;
  return (
    <Link
      href={`/portal/cases/${c.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative h-40 overflow-hidden bg-footerBg">
        <Image
          src={img.src}
          alt=""
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover transition duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-footerBg/85 via-footerBg/25 to-footerBg/10" />
        <div className="absolute left-4 top-4">
          <StatusBadge kind="case" value={c.status} variant="glass" />
        </div>
        <p className="absolute bottom-3 left-4 text-sm font-medium text-white/90">
          {CASE_TYPE_LABELS[c.case_type]}
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug text-navy">
            {c.title}
          </h3>
          {c.location_description && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
              <PinIcon size={14} className="shrink-0 text-neutral-400" />
              <span className="line-clamp-1">{c.location_description}</span>
            </p>
          )}
        </div>

        {steps.length > 0 ? (
          <div>
            <div className="flex gap-1" aria-hidden="true">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={`h-1.5 flex-1 rounded-full ${statusStyle("milestone", s.status).bar}`}
                />
              ))}
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              <span className="font-semibold text-navy">{done}</span> of {steps.length} step
              {steps.length === 1 ? "" : "s"} verified
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">
            Your verification steps will appear once the scope is agreed.
          </p>
        )}

        {(verdict || feeDue) && (
          <div className="flex flex-wrap gap-2">
            {verdict && <StatusBadge kind="verdict" value={verdict} />}
            {feeDue && <StatusBadge kind="payment" value="pending" label="Fee due" />}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="text-neutral-400">Updated {timeAgo(c.updated_at)}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-navy transition group-hover:bg-stamp group-hover:text-white motion-reduce:transition-none">
            <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm md:grid md:grid-cols-2">
      <div className="relative min-h-[220px] bg-footerBg">
        <Image
          src="/hero-construction.jpg"
          alt="A home under construction on a site in Nigeria"
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-footerBg/60 to-transparent" />
      </div>
      <div className="flex flex-col justify-center gap-4 p-7 sm:p-9">
        <h2 className="font-display text-2xl font-bold tracking-tight text-navy">
          Your first verification starts here
        </h2>
        <p className="leading-relaxed text-neutral-600">
          Tell us about the land, the build or the farm you want checked. We agree the scope and
          fee with you first, then our team inspects it on the ground and reports back with photos
          and a clear recommendation.
        </p>
        <div>
          <Link
            href="/portal/new"
            className="inline-flex items-center gap-2 rounded-full bg-stamp px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stampDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
          >
            <PlusIcon size={16} />
            Request verification
          </Link>
        </div>
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading your cases">
      <div className="space-y-3">
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
