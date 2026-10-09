"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, IntakeProcessStage, Lead, LeadIntake } from "@/lib/types";
import { CASE_TYPE_LABELS, INTAKE_PROCESS_LABELS } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import BackLink from "@/components/BackLink";
import Link from "next/link";
import { MAX_VISITS, buildVisitQuote, fieldCostNgn, isVisitService, type VisitZone } from "@/lib/visitPricing";

const FIELD = "w-full rounded border border-line bg-paper px-3 py-2 text-sm";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [account, setAccount] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // call link
  const [callLink, setCallLink] = useState("");
  // intake
  const [intake, setIntake] = useState<Partial<LeadIntake>>({});
  const [savingIntake, setSavingIntake] = useState(false);
  // quote
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState<"USD" | "NGN">("USD");
  const [depositPct, setDepositPct] = useState("50");
  const [creating, setCreating] = useState(false);
  // per-visit pricing (site inspection and farm oversight)
  const [zones, setZones] = useState<VisitZone[]>([]);
  const [visitFee, setVisitFee] = useState(0);
  const [rate, setRate] = useState<number | null>(null);
  const [zoneCode, setZoneCode] = useState("");
  const [visits, setVisits] = useState("1");
  const [custom, setCustom] = useState(false);
  const [manualLink, setManualLink] = useState<{ link: string; caseId: string } | null>(null);

  const load = useCallback(async () => {
    const { data: l } = await supabase.from("leads").select("*").eq("id", id).single();
    const row = l as Lead | null;
    setLead(row);
    if (row) {
      setCallLink(row.call_link ?? "");
      setTitle((t) => t || row.summary);
      const { data: i } = await supabase.from("lead_intake").select("*").eq("lead_id", id).maybeSingle();
      setIntake((i as LeadIntake | null) ?? {});
      const [{ data: z }, { data: bs }] = await Promise.all([
        supabase.from("visit_zones").select("*").order("sort_order"),
        supabase.from("booking_settings").select("visit_fee_usd, usd_to_ngn_rate").single(),
      ]);
      const zs = (z as VisitZone[]) ?? [];
      setZones(zs);
      setZoneCode((c) => c || zs[0]?.code || "");
      const b = bs as { visit_fee_usd: number; usd_to_ngn_rate: number | null } | null;
      setVisitFee(Number(b?.visit_fee_usd ?? 0));
      setRate(b?.usd_to_ngn_rate ? Number(b.usd_to_ngn_rate) : null);
      // An existing client account for this person, if there is one.
      const q = supabase.from("users").select("*").eq("role", "client");
      const { data: u } = row.client_id
        ? await q.eq("id", row.client_id).maybeSingle()
        : await q.ilike("email", row.email).maybeSingle();
      setAccount((u as AppUser | null) ?? null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patchLead(patch: Partial<Lead>, msg?: string) {
    setError(null);
    const { error: err } = await supabase.from("leads").update(patch).eq("id", id);
    if (err) setError(err.message);
    else if (msg) setNotice(msg);
    load();
  }

  async function saveIntake() {
    setSavingIntake(true);
    setError(null);
    const { data: me } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("lead_intake").upsert({
      lead_id: id,
      process_stage: intake.process_stage ?? null,
      documents_held: intake.documents_held || null,
      goal: intake.goal || null,
      deadline: intake.deadline || null,
      notes: intake.notes || null,
      updated_by: me.user?.id ?? null,
      updated_at: new Date().toISOString(),
    });
    setSavingIntake(false);
    if (err) setError(err.message);
    else setNotice("Intake notes saved.");
  }

  // Visit services are priced per visit and prepaid in full; everything else is a custom quote.
  const visitMode = !!lead && isVisitService(lead.service) && !custom;
  const zone = zones.find((z) => z.code === zoneCode);
  const vq = visitMode ? buildVisitQuote({ visits: Number(visits), zone, feeUsd: visitFee, rate }) : null;
  const totalNum = visitMode ? (vq?.total ?? 0) : Number(total);
  const pct = visitMode ? 100 : Number(depositPct);
  const quoteCurrency: "USD" | "NGN" = visitMode ? "USD" : currency;
  const validQuote = totalNum > 0 && pct > 0 && pct <= 100 && title.trim().length >= 3;
  const deposit = validQuote ? Math.round(totalNum * pct) / 100 : 0;

  async function createCase() {
    if (!lead || !validQuote) return;
    setCreating(true);
    setError(null);
    try {
      let clientId = account?.id ?? null;
      let inviteLink: string | null = null;
      if (!clientId) {
        // No account yet: send them Supabase's invite email, which lets them set
        // their own password. The profile row is created by a database trigger.
        const { data: sess } = await supabase.auth.getSession();
        const res = await fetch("/api/admin/invite-user", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token}` },
          body: JSON.stringify({ full_name: lead.name, email: lead.email, whatsapp_number: lead.phone, role: "client" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not invite the client.");
        clientId = json.userId as string;
        if (json.emailed === false && json.inviteLink) inviteLink = json.inviteLink as string;
      }
      const { data: caseId, error: err } = await supabase.rpc("convert_lead", {
        p_lead: lead.id,
        p_client: clientId,
        p_title: title.trim(),
        p_total: totalNum,
        p_currency: quoteCurrency,
        p_deposit_percent: pct,
        p_lines: vq ? vq.lines : null,
      });
      if (err) throw new Error(err.message);
      if (inviteLink) {
        // Email isn't set up: show the one-time link instead of leaving the page.
        setManualLink({ link: inviteLink, caseId: caseId as string });
        setCreating(false);
        return;
      }
      router.push(`/admin/cases/${caseId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setCreating(false);
    }
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!lead) return <p className="text-sm text-neutral-500">Lead not found.</p>;

  const converted = lead.stage === "converted";
  const wa = lead.phone ? `https://wa.me/${lead.phone.replace(/\D/g, "")}` : null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <BackLink href="/admin/leads">Leads</BackLink>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-xl font-bold text-navy">{lead.name}</h1>
          <StatusBadge kind="lead" value={lead.stage} />
        </div>
      </div>

      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      {manualLink && (
        <div role="status" className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Case created. The invite email couldn&apos;t be sent (email isn&apos;t set up yet).</p>
          <p className="mt-1">Send {lead.name} this one-time link so they can set a password and see their quote:</p>
          <input readOnly value={manualLink.link} onFocus={(e) => e.currentTarget.select()} className="mt-2 w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs" />
          <button onClick={() => router.push(`/admin/cases/${manualLink.caseId}`)} className="mt-3 rounded bg-navy px-3 py-1.5 text-sm font-medium text-white">Open the case</button>
        </div>
      )}

      <Card title="Request">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Service">{CASE_TYPE_LABELS[lead.service]}</Item>
          <Item label="Received">{new Date(lead.created_at).toLocaleString()}</Item>
          <Item label="Email">
            <a className="text-stamp hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a>
          </Item>
          <Item label="Phone / WhatsApp">
            {lead.phone ? <a className="text-stamp hover:underline" href={wa ?? undefined} target="_blank" rel="noreferrer">{lead.phone}</a> : "—"}
          </Item>
          <Item label="Account">
            {account ? `Has an account (${account.full_name})` : "No account yet. We email them a link to set a password when you create the case."}
          </Item>
        </dl>
        <p className="mt-4 font-medium text-navy">{lead.summary}</p>
        {lead.details && <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{lead.details}</p>}
      </Card>

      <Card title="Intake call">
        {lead.call_at ? (
          <p className="text-sm">
            <span className="font-semibold text-navy">
              {new Date(lead.call_at).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>{" "}
            · {lead.call_minutes} minutes
          </p>
        ) : (
          <p className="text-sm text-neutral-500">
            Not booked yet. Their booking link:{" "}
            <code className="break-all rounded bg-paper px-1.5 py-0.5 text-xs">
              {typeof window !== "undefined" ? `${window.location.origin}/book/${lead.token}` : ""}
            </code>
          </p>
        )}
        <div className="mt-3">
          <label htmlFor="call-link" className="mb-1 block text-xs font-medium text-neutral-600">Video call link for this person</label>
          <div className="flex gap-2">
            <input id="call-link" value={callLink} onChange={(e) => setCallLink(e.target.value)} placeholder="https://meet.google.com/…" className={FIELD} />
            <button onClick={() => patchLead({ call_link: callLink.trim() || null }, "Call link saved.")} className="shrink-0 rounded bg-navy px-3 py-2 text-sm font-medium text-white">Save</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {lead.stage === "call_booked" && (
            <button onClick={() => patchLead({ stage: "call_done" }, "Marked as done.")} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">Mark call done</button>
          )}
          {!converted && lead.stage !== "lost" && (
            <button onClick={() => patchLead({ stage: "lost" })} className="rounded border border-line px-3 py-1.5 text-sm text-neutral-600 hover:bg-paper">Close this lead</button>
          )}
          {lead.stage === "lost" && (
            <button onClick={() => patchLead({ stage: lead.call_at ? "call_booked" : "new" })} className="rounded border border-line px-3 py-1.5 text-sm text-neutral-600 hover:bg-paper">Reopen</button>
          )}
        </div>
      </Card>

      <Card title="What we learned on the call (private)">
        <div className="space-y-3">
          <div>
            <label htmlFor="in-stage" className="mb-1 block text-xs font-medium text-neutral-600">Where are they in the process?</label>
            <select id="in-stage" value={intake.process_stage ?? ""} onChange={(e) => setIntake({ ...intake, process_stage: (e.target.value || null) as IntakeProcessStage | null })} className={FIELD}>
              <option value="">Not recorded</option>
              {Object.entries(INTAKE_PROCESS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <TextArea id="in-docs" label="Documents they already hold" value={intake.documents_held} onChange={(v) => setIntake({ ...intake, documents_held: v })} />
          <TextArea id="in-goal" label="What they want to achieve" value={intake.goal} onChange={(v) => setIntake({ ...intake, goal: v })} />
          <div>
            <label htmlFor="in-deadline" className="mb-1 block text-xs font-medium text-neutral-600">Deadline</label>
            <input id="in-deadline" value={intake.deadline ?? ""} onChange={(e) => setIntake({ ...intake, deadline: e.target.value })} className={FIELD} placeholder="e.g. Before closing on 30 November" />
          </div>
          <TextArea id="in-notes" label="Other notes" value={intake.notes} onChange={(v) => setIntake({ ...intake, notes: v })} rows={4} />
          <button onClick={saveIntake} disabled={savingIntake} className="rounded bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {savingIntake ? "Saving…" : "Save notes"}
          </button>
        </div>
      </Card>

      {converted ? (
        <Card title="Quote">
          <p className="text-sm text-neutral-700">A case and quote were created from this lead.</p>
          {lead.converted_case_id && (
            <button onClick={() => router.push(`/admin/cases/${lead.converted_case_id}`)} className="mt-3 rounded bg-navy px-4 py-2 text-sm font-medium text-white">Open the case</button>
          )}
        </Card>
      ) : (
        <Card title="Scope and quote">
          <p className="mb-3 text-sm text-neutral-600">
            {visitMode
              ? "Creates the case and one invoice for the full amount. The client pays it before any work or assignment can begin."
              : "Creates the case, a deposit invoice and a balance invoice. The client pays the deposit before any work or assignment can begin."}
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="q-title" className="mb-1 block text-xs font-medium text-neutral-600">Case title (the client sees this)</label>
              <input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
            </div>
            {visitMode ? (
              <div className="space-y-3 rounded border border-line bg-paper p-3">
                <p className="text-sm text-neutral-700">
                  Priced per visit: your service fee plus the field agent&apos;s wage, transport and data. The client pays the
                  whole amount up front.
                </p>
                {zones.length === 0 || rate === null ? (
                  <p className="text-sm text-amber-800">
                    {zones.length === 0 ? "No visit zones found. Run migration 0009. " : "Set the naira rate first. "}
                    <Link href="/admin/settings" className="underline">Open settings</Link>
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="q-zone" className="mb-1 block text-xs font-medium text-neutral-600">Where is the site?</label>
                        <select id="q-zone" value={zoneCode} onChange={(e) => setZoneCode(e.target.value)} className={FIELD}>
                          {zones.map((z) => (
                            <option key={z.code} value={z.code}>{z.code}: {z.label} (₦{fieldCostNgn(z).toLocaleString()} per visit)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="q-visits" className="mb-1 block text-xs font-medium text-neutral-600">Number of visits</label>
                        <input id="q-visits" type="number" min="1" max={MAX_VISITS} step="1" value={visits} onChange={(e) => setVisits(e.target.value)} className={FIELD} />
                      </div>
                    </div>
                    {vq ? (
                      <table className="w-full text-sm">
                        <tbody>
                          {vq.lines.map((l) => (
                            <tr key={l.label} className="border-t border-line first:border-t-0">
                              <td className="py-1.5 pr-3 text-neutral-700">{l.label}</td>
                              <td className="py-1.5 text-right tabular-nums">USD {l.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-navy font-semibold text-navy">
                            <td className="py-1.5 pr-3">Total (about USD {vq.perVisit.toFixed(2)} per visit)</td>
                            <td className="py-1.5 text-right tabular-nums">USD {vq.total.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-sm text-amber-800">Enter a whole number of visits from 1 to {MAX_VISITS}.</p>
                    )}
                  </>
                )}
                <button type="button" onClick={() => setCustom(true)} className="text-xs text-neutral-500 underline">Quote a custom amount instead</button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="q-total" className="mb-1 block text-xs font-medium text-neutral-600">Total fee</label>
                    <input id="q-total" type="number" min="0" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} className={FIELD} />
                  </div>
                  <div>
                    <label htmlFor="q-cur" className="mb-1 block text-xs font-medium text-neutral-600">Currency</label>
                    <select id="q-cur" value={currency} onChange={(e) => setCurrency(e.target.value as "USD" | "NGN")} className={FIELD}>
                      <option value="USD">USD</option>
                      <option value="NGN">NGN</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="q-pct" className="mb-1 block text-xs font-medium text-neutral-600">Deposit %</label>
                    <input id="q-pct" type="number" min="1" max="100" value={depositPct} onChange={(e) => setDepositPct(e.target.value)} className={FIELD} />
                  </div>
                </div>
                {lead && isVisitService(lead.service) && (
                  <button type="button" onClick={() => setCustom(false)} className="text-xs text-neutral-500 underline">Use the per-visit pricing instead</button>
                )}
              </>
            )}
            {validQuote && (
              <p className="rounded bg-paper px-3 py-2 text-sm text-neutral-700">
                Deposit due now: <b>{quoteCurrency} {deposit.toLocaleString()}</b>
                {totalNum - deposit > 0 && <> · Balance: <b>{quoteCurrency} {(totalNum - deposit).toLocaleString()}</b></>}
              </p>
            )}
            <button onClick={createCase} disabled={!validQuote || creating} className="rounded bg-stamp px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {creating ? "Creating…" : account ? "Create case and send quote" : "Invite client and create case"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="mb-3 font-display text-base font-semibold text-navy">{title}</h2>
      {children}
    </section>
  );
}
function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd className="text-neutral-800">{children}</dd>
    </div>
  );
}
function TextArea({ id, label, value, onChange, rows = 2 }: { id: string; label: string; value: string | null | undefined; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-600">{label}</label>
      <textarea id={id} rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={FIELD} />
    </div>
  );
}
