"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { CaseType, LeadStage } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import { downloadIcs, googleCalendarUrl, type CallEvent } from "@/lib/calendar";
import Logo from "@/components/Logo";
import Skeleton from "@/components/portal/Skeleton";
import { CheckIcon, ClockIcon, DownloadIcon } from "@/components/portal/icons";

interface BookingInfo {
  name: string;
  service: CaseType;
  summary: string;
  stage: LeadStage;
  call_at: string | null;
  call_minutes: 30 | 60 | null;
  call_link: string | null;
  timezone: string;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function BookCallPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("lead_booking_info", { p_token: token });
    const row = Array.isArray(data) ? data[0] : data;
    setInfo((row as BookingInfo | undefined) ?? null);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const myZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  return (
    <div className="min-h-screen bg-paper bg-[radial-gradient(60rem_26rem_at_50%_-8rem,#EAF0F6,transparent)] font-body">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="iConfam home" className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stamp">
          <Logo height={28} />
        </Link>
        <Link href="/" className="text-sm font-medium text-neutral-600 hover:text-navy hover:underline">
          Back to iConfam
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
        {loading ? (
          <div role="status" aria-label="Loading" className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        ) : !info ? (
          <Notice title="We couldn't find that booking link">
            Check that you opened the full link we gave you, or{" "}
            <Link href="/start" className="font-medium text-stamp hover:underline">
              send a new request
            </Link>
            .
          </Notice>
        ) : info.stage === "call_booked" && info.call_at && info.call_minutes && !rescheduling ? (
          <Confirmed
            info={info}
            token={token}
            zone={myZone}
            onReschedule={() => setRescheduling(true)}
            onCancelled={() => {
              setRescheduling(false);
              load();
            }}
          />
        ) : info.stage === "new" || info.stage === "call_booked" ? (
          <Picker
            info={info}
            token={token}
            zone={myZone}
            onBooked={() => {
              setRescheduling(false);
              load();
            }}
            onBack={info.stage === "call_booked" ? () => setRescheduling(false) : undefined}
          />
        ) : (
          <Notice title="Your call is already done">
            We&apos;re working on your plan.{" "}
            <Link href="/login?role=client" className="font-medium text-stamp hover:underline">
              Sign in
            </Link>{" "}
            to see where things stand.
          </Notice>
        )}
      </main>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
      <h1 className="font-display text-xl font-semibold text-navy">{title}</h1>
      <p className="mt-2 text-neutral-600">{children}</p>
      <Link href="/" className="mt-5 inline-block text-sm font-medium text-stamp hover:underline">
        Back to iConfam
      </Link>
    </div>
  );
}

function Picker({
  info,
  token,
  zone,
  onBooked,
  onBack,
}: {
  info: BookingInfo;
  token: string;
  zone: string;
  onBooked: () => void;
  onBack?: () => void;
}) {
  const [minutes, setMinutes] = useState<30 | 60>(info.service === "status_verification" ? 30 : 60);
  const [slots, setSlots] = useState<Date[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    setSlots(null);
    const { data } = await supabase.rpc("available_slots", { p_minutes: minutes });
    const list = ((data as string[] | null) ?? []).map((s) => new Date(s));
    setSlots(list);
    setChosen(null);
    setDay((cur) => (cur && list.some((d) => dayKey(d) === cur) ? cur : list[0] ? dayKey(list[0]) : null));
  }, [minutes]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const days = useMemo(() => {
    const map = new Map<string, Date[]>();
    for (const s of slots ?? []) {
      const k = dayKey(s);
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return map;
  }, [slots]);

  async function confirm() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("book_lead_call", {
      p_token: token,
      p_start: chosen.toISOString(),
      p_minutes: minutes,
    });
    setBusy(false);
    if (err) {
      if (err.message.includes("slot_unavailable")) {
        setError("Someone just took that time. Please pick another.");
        loadSlots();
      } else {
        setError("We couldn't book that time. Please try again.");
      }
      return;
    }
    onBooked();
  }

  const fmtDay = (k: string) => {
    const d = days.get(k)?.[0];
    return d
      ? { wd: d.toLocaleDateString(undefined, { weekday: "short" }), md: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) }
      : { wd: "", md: k };
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight text-navy">
        {onBack ? "Pick a new time" : `Thanks, ${info.name.split(" ")[0]}. Pick a time to talk.`}
      </h1>
      <p className="mt-2 max-w-prose leading-relaxed text-neutral-600">
        A short call so we understand where you are with{" "}
        <span className="font-medium text-navy">{info.summary}</span> ({CASE_TYPE_LABELS[info.service]}).
        Nothing is charged on this call.
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy">How long?</legend>
          <div className="flex flex-wrap gap-2">
            {([30, 60] as const).map((m) => (
              <label
                key={m}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-stamp ${
                  minutes === m ? "border-navy bg-navy text-white" : "border-line bg-white text-neutral-700 hover:border-slate-400"
                }`}
              >
                <input type="radio" name="minutes" className="sr-only" checked={minutes === m} onChange={() => setMinutes(m)} />
                {m} minutes
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            30 minutes suits a single document or status check. Choose 60 for a build, a farm or a stalled process.
          </p>
        </fieldset>

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-navy">Choose a day</h2>
          {slots === null ? (
            <Skeleton className="h-16 w-full" />
          ) : days.size === 0 ? (
            <p className="rounded-xl bg-paper p-4 text-sm text-neutral-600">
              No times are open right now. Please check back soon, or email us and we&apos;ll arrange one.
            </p>
          ) : (
            <>
              <div role="radiogroup" aria-label="Day" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                {[...days.keys()].map((k) => {
                  const f = fmtDay(k);
                  const on = day === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setDay(k);
                        setChosen(null);
                      }}
                      className={`shrink-0 rounded-xl border px-3.5 py-2 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp ${
                        on ? "border-stamp bg-stamp/10 text-navy" : "border-line bg-white text-neutral-700 hover:border-slate-400"
                      }`}
                    >
                      <span className="block text-xs text-neutral-500">{f.wd}</span>
                      <span className="block text-sm font-semibold">{f.md}</span>
                    </button>
                  );
                })}
              </div>

              <h2 className="mb-2 mt-4 text-sm font-semibold text-navy">Choose a time</h2>
              <div role="radiogroup" aria-label="Time" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {(day ? days.get(day) ?? [] : []).map((s) => {
                  const on = chosen?.getTime() === s.getTime();
                  return (
                    <button
                      key={s.toISOString()}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setChosen(s)}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium tabular-nums transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp ${
                        on ? "border-navy bg-navy text-white" : "border-line bg-white text-neutral-700 hover:border-slate-400"
                      }`}
                    >
                      {s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
                <ClockIcon size={14} /> Times are shown in your time zone ({zone.replace("_", " ")}).
              </p>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={!chosen || busy}
            className="inline-flex items-center rounded-full bg-stamp px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-stampDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Booking…" : chosen ? `Book ${chosen.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "Book this time"}
          </button>
          {onBack && (
            <button type="button" onClick={onBack} className="text-sm font-medium text-neutral-600 hover:underline">
              Keep my current time
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Confirmed({
  info,
  token,
  zone,
  onReschedule,
  onCancelled,
}: {
  info: BookingInfo;
  token: string;
  zone: string;
  onReschedule: () => void;
  onCancelled: () => void;
}) {
  const start = new Date(info.call_at as string);
  const minutes = info.call_minutes as number;
  const [busy, setBusy] = useState(false);
  const event: CallEvent = {
    title: "iConfam intake call",
    start,
    minutes,
    uid: token,
    description:
      `A ${minutes}-minute call with the iConfam team about: ${info.summary}.` +
      (info.call_link ? `\nJoin: ${info.call_link}` : ""),
    location: info.call_link ?? undefined,
  };

  async function cancel() {
    if (!window.confirm("Cancel this call? You can book another time afterwards.")) return;
    setBusy(true);
    await supabase.rpc("cancel_lead_call", { p_token: token });
    setBusy(false);
    onCancelled();
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm" aria-hidden="true">
          <CheckIcon size={22} />
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-navy">Your call is booked</h1>
      </div>

      <section className="mt-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
        <p className="font-display text-2xl font-semibold text-navy">
          {start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <p className="mt-1 text-lg text-neutral-700">
          {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {minutes} minutes
          <span className="text-sm text-neutral-500"> ({zone.replace("_", " ")})</span>
        </p>
        <p className="mt-3 text-sm text-neutral-600">
          About: <span className="font-medium text-navy">{info.summary}</span>
        </p>
        <p className="mt-3 text-sm text-neutral-700">
          {info.call_link ? (
            <>
              Join here:{" "}
              <a href={info.call_link} target="_blank" rel="noreferrer" className="break-all font-medium text-stamp hover:underline">
                {info.call_link}
              </a>
            </>
          ) : (
            "We'll send you the video link before the call. Please save this page."
          )}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            Add to Google Calendar
          </a>
          <button
            type="button"
            onClick={() => downloadIcs(event)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
          >
            <DownloadIcon size={16} /> Apple / Outlook (.ics)
          </button>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-4 text-sm">
        <button type="button" onClick={onReschedule} className="font-medium text-stamp hover:underline">
          Change the time
        </button>
        <button type="button" onClick={cancel} disabled={busy} className="font-medium text-neutral-500 hover:underline">
          Cancel the call
        </button>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center rounded-full bg-stamp px-6 py-3 text-sm font-semibold text-white transition hover:bg-stampDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
        >
          Back to iConfam
        </Link>
        <Link href="/login?role=client" className="text-sm font-medium text-stamp hover:underline">
          Sign in to your account
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-navy">To get the most from the call</h2>
        <ul className="mt-3 max-w-prose list-disc space-y-1.5 pl-5 text-neutral-700">
          <li>Have any documents you already hold to hand (survey plan, deed, receipts).</li>
          <li>Be ready to say how far the process has got, and what you want to achieve.</li>
          <li>Tell us your deadline, if you have one.</li>
        </ul>
      </section>
    </div>
  );
}
