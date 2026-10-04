"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, CaseType } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import BackLink from "@/components/BackLink";

export default function NewCasePage() {
  const router = useRouter();
  const [clients, setClients] = useState<AppUser[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);

  const [title, setTitle] = useState("");
  const [caseType, setCaseType] = useState<CaseType>("status_verification");
  const [clientId, setClientId] = useState("");
  const [location, setLocation] = useState("");
  const [agentId, setAgentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: users } = await supabase.from("users").select("*").order("full_name");
      const all = (users as AppUser[]) ?? [];
      setClients(all.filter((u) => u.role === "client"));
      setAgents(all.filter((u) => u.role === "agent" && u.active));
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError("Select a client — if they don't exist yet, invite them first from Agents & Professionals.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("cases")
      .insert({
        title,
        case_type: caseType,
        client_id: clientId,
        location_description: location || null,
        assigned_agent_id: agentId || null,
        status: "intake",
      })
      .select()
      .single();
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(`/admin/cases/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <BackLink href="/admin/cases">All cases</BackLink>
      <h1 className="mb-6 font-display text-xl font-bold text-navy">New Case</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-white p-6">
        <Field label="Title" id="case-title">
          <input
            id="case-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Adeyemi — pending C of O status check"
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Case type" id="case-type">
          <select
            id="case-type"
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
        </Field>

        <Field label="Client" id="case-client">
          <select
            id="case-client"
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} {c.email ? `(${c.email})` : ""}
              </option>
            ))}
          </select>
          {clients.length === 0 && (
            <p className="mt-1 text-xs text-neutral-400">
              No client accounts yet — invite one from Agents & Professionals first.
            </p>
          )}
        </Field>

        <Field label="Location / description" id="case-location">
          <textarea
            id="case-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            rows={2}
            placeholder="e.g. Land at Ikorodu, Lagos — pending Governor's Consent"
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Assign field agent (optional)" id="case-agent">
          <select
            id="case-agent"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name} {a.region ? `— ${a.region}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <p className="text-xs text-neutral-400">
          Lawyers, surveyors, architects and other professionals are added from the case page
          once it&apos;s created, by specialty.
        </p>

        {error && <p className="text-sm text-stamp">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-stamp py-2 text-sm font-semibold text-white hover:bg-stampDark disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create Case"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-neutral-600">
        {label}
      </label>
      {children}
    </div>
  );
}
