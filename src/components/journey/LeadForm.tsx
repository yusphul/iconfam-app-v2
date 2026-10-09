"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { CaseType } from "@/lib/types";
import ServicePicker from "@/components/journey/ServicePicker";

export const FIELD =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy shadow-sm transition placeholder:text-neutral-400 focus:border-stamp focus:outline-none focus:ring-2 focus:ring-stamp/25";

// The "I'm interested" form. It records the request, then sends the person
// straight to pick a time for their intake call.
export default function LeadForm({
  initialName = "",
  initialEmail = "",
  lockEmail = false,
}: {
  initialName?: string;
  initialEmail?: string;
  lockEmail?: boolean;
}) {
  const router = useRouter();
  const startedAt = useRef(Date.now());
  const [service, setService] = useState<CaseType>("property_purchase");
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [summary, setSummary] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [details, setDetails] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          service,
          summary,
          siteAddress,
          details,
          company,
          startedAt: startedAt.current,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.token) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      router.push(`/book/${json.token}`);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <ServicePicker value={service} onChange={setService} />

      <div className="space-y-5 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="lead-name" className="mb-1.5 block text-sm font-medium text-navy">
              Your name
            </label>
            <input
              id="lead-name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="lead-email" className="mb-1.5 block text-sm font-medium text-navy">
              Email
            </label>
            <input
              id="lead-email"
              type="email"
              required
              autoComplete="email"
              readOnly={lockEmail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${FIELD} ${lockEmail ? "bg-paper text-neutral-500" : ""}`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="lead-phone" className="mb-1.5 block text-sm font-medium text-navy">
            WhatsApp or phone (optional)
          </label>
          <input
            id="lead-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 123 4567"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="lead-summary" className="mb-1.5 block text-sm font-medium text-navy">
            Short description
          </label>
          <input
            id="lead-summary"
            required
            maxLength={300}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="e.g. Governor's consent for a plot in Ikorodu, Lagos"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="lead-address" className="mb-1.5 block text-sm font-medium text-navy">
            Property or farm address
          </label>
          <input
            id="lead-address"
            required
            minLength={5}
            maxLength={300}
            autoComplete="street-address"
            value={siteAddress}
            onChange={(e) => setSiteAddress(e.target.value)}
            placeholder="Street, area or landmark, town, state"
            className={FIELD}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Our field agent must be physically at this place before they can send you any photos or updates.
          </p>
        </div>
        <div>
          <label htmlFor="lead-details" className="mb-1.5 block text-sm font-medium text-navy">
            Anything else we should know? (optional)
          </label>
          <textarea
            id="lead-details"
            rows={4}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g. The paperwork has been pending for 6 months and I want to confirm it's actually moving."
            className={FIELD}
          />
        </div>

        {/* Honeypot: real visitors never see or fill this. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
          <label>
            Company
            <input
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center rounded-full bg-stamp px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-stampDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send request"}
          </button>
          <p className="text-sm text-neutral-500">Next, you&apos;ll pick a time for a short call.</p>
        </div>
      </div>
    </form>
  );
}

export const JOURNEY_STEPS: [string, string][] = [
  ["Tell us what you need", "A few details, two minutes."],
  ["Talk to us", "A 30 or 60 minute call so we understand where you are."],
  ["Get a scope and fee", "Fixed price. Pay a deposit to start. Nothing before that."],
  ["We verify on the ground", "Follow every step, photo and report in your portal."],
];
