"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, Case, UserRole } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import Badge from "@/components/Badge";

export default function AgentsDirectoryPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  async function load() {
    const [{ data: u }, { data: c }] = await Promise.all([
      supabase.from("users").select("*").order("full_name"),
      supabase.from("cases").select("*"),
    ]);
    setUsers((u as AppUser[]) ?? []);
    setCases((c as Case[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const fieldPeople = users.filter((u) => u.role === "agent" || u.role === "professional");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-navy">Agents & Professionals</h1>
        <button
          onClick={() => setShowInvite((s) => !s)}
          className="rounded bg-stamp px-4 py-2 text-sm font-semibold text-white hover:bg-stampDark"
        >
          {showInvite ? "Close" : "+ Invite"}
        </button>
      </div>

      {showInvite && <InviteForm onCreated={load} />}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          {fieldPeople.map((person) => {
            const assignedCases = cases.filter(
              (c) => c.assigned_agent_id === person.id || c.assigned_professional_id === person.id
            );
            // Anti-collusion signal: flag if this person has been assigned to the
            // same location/description more than once — a manual review nudge,
            // not an automatic block.
            const repeatLocations = assignedCases
              .map((c) => c.location_description)
              .filter(Boolean)
              .filter((loc, i, arr) => arr.indexOf(loc) !== i);

            return (
              <div key={person.id} className="rounded-lg border border-line bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-navy">{person.full_name}</span>
                    <Badge className="ml-2 border-line text-neutral-600">{person.role}</Badge>
                    {person.region && (
                      <span className="ml-2 text-xs text-neutral-400">{person.region}</span>
                    )}
                  </div>
                  <span className="text-xs text-neutral-400">
                    {assignedCases.length} case{assignedCases.length === 1 ? "" : "s"} assigned
                  </span>
                </div>
                {repeatLocations.length > 0 && (
                  <p className="mb-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                    ⚠ Assigned more than once to the same location/relationship — review before
                    reassigning again (rotation is part of the anti-collusion design).
                  </p>
                )}
                <ul className="space-y-1 text-sm text-neutral-600">
                  {assignedCases.map((c) => (
                    <li key={c.id}>
                      {c.title} — {CASE_TYPE_LABELS[c.case_type]}
                    </li>
                  ))}
                  {assignedCases.length === 0 && (
                    <li className="text-neutral-400">No cases assigned yet.</li>
                  )}
                </ul>
              </div>
            );
          })}
          {fieldPeople.length === 0 && (
            <p className="text-sm text-neutral-400">
              No field agents or professionals yet — invite the first one above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InviteForm({ onCreated }: { onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [role, setRole] = useState<UserRole>("agent");
  const [region, setRegion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        full_name: fullName,
        email,
        whatsapp_number: whatsapp || null,
        role,
        region: region || null,
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setSuccess(true);
    setFullName("");
    setEmail("");
    setWhatsapp("");
    setRegion("");
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-3 rounded-lg border border-line bg-white p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded border border-line bg-paper px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-line bg-paper px-3 py-2 text-sm"
        />
        <input
          placeholder="WhatsApp number"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className="rounded border border-line bg-paper px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="rounded border border-line bg-paper px-3 py-2 text-sm"
        >
          <option value="agent">Field agent</option>
          <option value="professional">Professional (lawyer/surveyor/architect)</option>
          <option value="client">Client</option>
        </select>
        <input
          placeholder="Region (e.g. Lagos)"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded border border-line bg-paper px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-stamp">{error}</p>}
      {success && <p className="text-sm text-verified">Invite email sent.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Sending invite…" : "Send invite"}
      </button>
      <p className="text-xs text-neutral-400">
        Supabase sends them a real email with a link to set their own password — there is
        no self-signup, and you never need to share a password yourself.
      </p>
    </form>
  );
}
