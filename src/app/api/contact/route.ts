import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// Public "Contact us" form endpoint — no sign-in required, by design. Two
// lightweight, no-infrastructure spam checks run before anything touches the
// database:
//
// 1. Honeypot ("company"): a field real visitors never see (kept off-screen
//    in ContactForm.tsx, not display:none, since some bots specifically
//    skip display:none fields) or interact with. Most bots that scrape and
//    fill in every input on a page will fill this one in too.
// 2. Time-trap (startedAt): the client records the moment the form mounted;
//    submitting faster than a person plausibly could — reading the fields,
//    typing a message — is a strong signal it wasn't a person.
//
// Both checks fail *silently* (respond 200 as if it worked) rather than
// with an error, so a bot that's testing for what trips the filter doesn't
// learn anything useful from the response.
//
// This does not stop a bot that skips the browser entirely and POSTs to
// this route directly with a fabricated startedAt and no honeypot value —
// no static-page contact form can fully rule that out without a real
// challenge (e.g. hCaptcha/Turnstile), which needs a site key registered to
// this domain once it has one. These two checks catch the overwhelming
// majority of the automated form-spam that actually reaches sites like
// this in practice.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SUBMIT_MS = 3000;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { name, email, message, company, startedAt } = (body ?? {}) as {
    name?: unknown;
    email?: unknown;
    message?: unknown;
    company?: unknown;
    startedAt?: unknown;
  };

  // Honeypot tripped — pretend success, drop the message.
  if (typeof company === "string" && company.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  // Submitted too fast to be a real person — pretend success, drop the message.
  const elapsedMs = typeof startedAt === "number" ? Date.now() - startedAt : null;
  if (elapsedMs !== null && elapsedMs < MIN_SUBMIT_MS) {
    return NextResponse.json({ ok: true });
  }

  if (typeof name !== "string" || name.trim().length < 2 || name.length > 200) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length < 10 || message.length > 5000) {
    return NextResponse.json(
      { error: "Please add a little more detail to your message." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("contact_messages").insert({
    name: name.trim(),
    email: email.trim(),
    message: message.trim(),
  });

  if (error) {
    console.error("contact_messages insert failed", error);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again, or email us directly." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
