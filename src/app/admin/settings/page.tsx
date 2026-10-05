"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Settings {
  timezone: string;
  slot_step_minutes: number;
  min_notice_hours: number;
  horizon_days: number;
  meeting_url: string | null;
  bank_instructions_usd: string | null;
  bank_instructions_ngn: string | null;
  usd_to_ngn_rate: number | null;
}
interface OutboxItem {
  id: string;
  kind: string;
  to_email: string | null;
  to_user_id: string | null;
  created_at: string;
  sent_at: string | null;
  attempts: number;
  last_error: string | null;
}
interface Rule {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FIELD = "w-full rounded border border-line bg-paper px-3 py-2 text-sm";
const hhmm = (t: string) => t.slice(0, 5);

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const [{ data: st }, { data: r }, { data: ob }] = await Promise.all([
      supabase.from("booking_settings").select("*").single(),
      supabase.from("availability_rules").select("*").order("weekday").order("start_time"),
      supabase
        .from("notification_outbox")
        .select("id, kind, to_email, to_user_id, created_at, sent_at, attempts, last_error")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    setOutbox((ob as OutboxItem[]) ?? []);
    setS(st as Settings);
    setRules((r as Rule[]) ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!s) return;
    setErr(null);
    setMsg(null);
    const { error } = await supabase
      .from("booking_settings")
      .update({
        timezone: s.timezone.trim(),
        slot_step_minutes: Number(s.slot_step_minutes),
        min_notice_hours: Number(s.min_notice_hours),
        horizon_days: Number(s.horizon_days),
        meeting_url: s.meeting_url?.trim() || null,
        bank_instructions_usd: s.bank_instructions_usd?.trim() || null,
        bank_instructions_ngn: s.bank_instructions_ngn?.trim() || null,
        usd_to_ngn_rate: s.usd_to_ngn_rate ? Number(s.usd_to_ngn_rate) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) setErr(error.message.includes("time zone") ? "That time zone name isn't valid (try America/Chicago)." : error.message);
    else setMsg("Saved.");
  }

  async function addRule(weekday: number) {
    const { error } = await supabase.from("availability_rules").insert({ weekday, start_time: "10:00", end_time: "16:00" });
    if (error) setErr(error.message);
    load();
  }
  async function updateRule(r: Rule, patch: Partial<Rule>) {
    const next = { ...r, ...patch };
    setRules((cur) => cur.map((x) => (x.id === r.id ? next : x)));
    if (next.end_time <= next.start_time) return; // wait until the range is valid
    const { error } = await supabase.from("availability_rules").update({ start_time: next.start_time, end_time: next.end_time }).eq("id", r.id);
    if (error) setErr(error.message);
  }
  async function removeRule(id: string) {
    await supabase.from("availability_rules").delete().eq("id", id);
    load();
  }

  if (!s) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-xl font-bold text-navy">Settings</h1>
      {err && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {msg && <p role="status" className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="mb-1 font-display text-base font-semibold text-navy">When people can book a call</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Hours are in the time zone below. Visitors see times converted to their own zone.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your time zone" id="tz"><input id="tz" value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} className={FIELD} /></Field>
          <Field label="Default video call link" id="mu"><input id="mu" value={s.meeting_url ?? ""} onChange={(e) => setS({ ...s, meeting_url: e.target.value })} placeholder="https://meet.google.com/…" className={FIELD} /></Field>
          <Field label="Start times every (minutes)" id="step"><select id="step" value={s.slot_step_minutes} onChange={(e) => setS({ ...s, slot_step_minutes: Number(e.target.value) })} className={FIELD}>{[15, 30, 60].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
          <Field label="Minimum notice (hours)" id="notice"><input id="notice" type="number" min="0" value={s.min_notice_hours} onChange={(e) => setS({ ...s, min_notice_hours: Number(e.target.value) })} className={FIELD} /></Field>
          <Field label="Book up to (days ahead)" id="hz"><input id="hz" type="number" min="1" max="90" value={s.horizon_days} onChange={(e) => setS({ ...s, horizon_days: Number(e.target.value) })} className={FIELD} /></Field>
        </div>

        <h3 className="mb-2 mt-6 text-sm font-semibold text-navy">Weekly hours</h3>
        <ul className="space-y-3">
          {DAYS.map((d, wd) => {
            const mine = rules.filter((r) => r.weekday === wd);
            return (
              <li key={d} className="flex flex-wrap items-start gap-3 text-sm">
                <span className="w-24 shrink-0 pt-2 text-neutral-700">{d}</span>
                <div className="space-y-2">
                  {mine.length === 0 && <span className="inline-block pt-2 text-neutral-400">Closed</span>}
                  {mine.map((r) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <input aria-label={`${d} opens`} type="time" value={hhmm(r.start_time)} onChange={(e) => updateRule(r, { start_time: e.target.value })} className="rounded border border-line bg-paper px-2 py-1.5" />
                      <span className="text-neutral-400">to</span>
                      <input aria-label={`${d} closes`} type="time" value={hhmm(r.end_time)} onChange={(e) => updateRule(r, { end_time: e.target.value })} className="rounded border border-line bg-paper px-2 py-1.5" />
                      <button onClick={() => removeRule(r.id)} className="text-xs text-red-600 hover:underline" aria-label={`Remove ${d} hours`}>Remove</button>
                    </div>
                  ))}
                  <button onClick={() => addRule(wd)} className="text-xs font-medium text-stamp hover:underline">+ Add hours</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="mb-1 font-display text-base font-semibold text-navy">How clients pay</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Shown to signed-in clients on a case that has a payment due. The naira rate is applied when a client reports a naira transfer, so the amount they owe is fixed at that moment.
        </p>
        <div className="space-y-3">
          <Field label="USD bank transfer details" id="busd"><textarea id="busd" rows={3} value={s.bank_instructions_usd ?? ""} onChange={(e) => setS({ ...s, bank_instructions_usd: e.target.value })} className={FIELD} placeholder="Account name, bank, routing and account number" /></Field>
          <Field label="Naira (NGN) bank transfer details" id="bngn"><textarea id="bngn" rows={3} value={s.bank_instructions_ngn ?? ""} onChange={(e) => setS({ ...s, bank_instructions_ngn: e.target.value })} className={FIELD} placeholder="Account name, bank, account number" /></Field>
          <Field label="Naira per 1 US dollar" id="rate"><input id="rate" type="number" min="0" step="0.01" value={s.usd_to_ngn_rate ?? ""} onChange={(e) => setS({ ...s, usd_to_ngn_rate: e.target.value ? Number(e.target.value) : null })} className={FIELD} placeholder="e.g. 1500" /></Field>
        </div>
      </section>

      <button onClick={save} className="rounded bg-navy px-5 py-2.5 text-sm font-semibold text-white">Save settings</button>

      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="mb-1 font-display text-base font-semibold text-navy">Recent emails</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Emails the app has queued. &quot;Waiting&quot; means not sent yet: if they stay waiting, email isn&apos;t set up
          (see RESEND_API_KEY) or the provider rejected them.
        </p>
        <ul className="divide-y divide-line text-sm">
          {outbox.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium text-navy">{o.kind.replace(/_/g, " ")}</span>
                <span className="ml-2 text-neutral-400">{o.to_email ?? "account email"}</span>
              </span>
              <span className="text-xs">
                {o.sent_at ? (
                  <span className="text-emerald-700">Sent {new Date(o.sent_at).toLocaleString()}</span>
                ) : o.attempts >= 5 ? (
                  <span className="text-red-700">Failed: {o.last_error}</span>
                ) : (
                  <span className="text-amber-700">Waiting{o.last_error ? `: ${o.last_error}` : ""}</span>
                )}
              </span>
            </li>
          ))}
          {outbox.length === 0 && <li className="py-3 text-neutral-400">Nothing yet.</li>}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
