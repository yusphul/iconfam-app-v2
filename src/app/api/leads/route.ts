import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runOutbox } from "@/lib/email/run";

// Public "I'm interested" endpoint. Same lightweight spam checks as the contact
// form (hidden honeypot field + a minimum time on the page), then the real work
// and validation happen in the database function submit_lead(). When the visitor
// is a signed-in client their token is forwarded, so the request is linked to
// their account.

const SERVICES = ["property_purchase", "ground_up_build", "farm_oversight", "status_verification"];
const MIN_SUBMIT_MS = 3000;

const ERRORS: Record<string, string> = {
  invalid_name: "Please enter your name.",
  invalid_email: "Please enter a valid email address.",
  invalid_summary: "Please describe what you need in a few words.",
  invalid_address: "Please enter the property or farm address, with the town or area and state.",
  too_long: "One of your answers is too long.",
  too_many_requests: "We already have several requests from this email today. We'll be in touch soon.",
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Bots: pretend it worked, give them nothing to learn from.
  if (typeof body.company === "string" && body.company.trim().length > 0) {
    return NextResponse.json({ ok: true, token: crypto.randomUUID() });
  }
  const elapsed = typeof body.startedAt === "number" ? Date.now() - body.startedAt : null;
  if (elapsed !== null && elapsed < MIN_SUBMIT_MS) {
    return NextResponse.json({ ok: true, token: crypto.randomUUID() });
  }

  const service = String(body.service ?? "");
  if (!SERVICES.includes(service)) {
    return NextResponse.json({ error: "Please choose what you need verified." }, { status: 400 });
  }

  const siteAddress = String(body.siteAddress ?? "").trim();
  if (siteAddress.length < 5) {
    return NextResponse.json({ error: ERRORS.invalid_address }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const client = createClient(url, anon, {
    global: bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.rpc("submit_lead", {
    p_name: String(body.name ?? ""),
    p_email: String(body.email ?? ""),
    p_phone: String(body.phone ?? ""),
    p_service: service,
    p_summary: String(body.summary ?? ""),
    p_details: String(body.details ?? ""),
    p_site_address: siteAddress,
  });

  if (error) {
    const known = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (known) return NextResponse.json({ error: ERRORS[known] }, { status: 400 });
    console.error("submit_lead failed", error);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again, or email us directly." },
      { status: 500 }
    );
  }
  const row = Array.isArray(data) ? data[0] : data;
  // Send the "we got your request" email now rather than waiting for the next run.
  try {
    await runOutbox(req.nextUrl.origin, 10);
  } catch (e) {
    console.error("sending lead emails failed", e);
  }
  return NextResponse.json({ ok: true, token: row?.token });
}
