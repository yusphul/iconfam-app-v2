import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Starts a Stripe Checkout payment for ONE invoice (a row in `payments`) that
// belongs to the signed-in client. The amount is read from our database, never
// from the browser, and the page is only offered when STRIPE_SECRET_KEY is set.
// Marking the invoice paid happens in /api/stripe/webhook, after Stripe confirms.

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Card payments aren't switched on yet." }, { status: 501 });
  }
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let paymentId = "";
  try {
    paymentId = String((await req.json()).paymentId ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Query as the user: row-level security means they can only see their own invoices.
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
  const { data: pay } = await supa
    .from("payments")
    .select("id, case_id, description, amount, currency, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!pay) return NextResponse.json({ error: "We couldn't find that payment." }, { status: 404 });
  if (pay.status !== "pending" && pay.status !== "overdue") {
    return NextResponse.json({ error: "This payment is already settled." }, { status: 400 });
  }
  if (pay.currency !== "USD") {
    return NextResponse.json({ error: "Card payment is for dollar invoices. Use a bank transfer." }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(Number(pay.amount) * 100)),
    "line_items[0][price_data][product_data][name]": `iConfam: ${pay.description}`,
    client_reference_id: pay.id,
    "metadata[payment_id]": pay.id,
    success_url: `${origin}/portal/cases/${pay.case_id}?paid=1`,
    cancel_url: `${origin}/portal/cases/${pay.case_id}`,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json.url) {
    console.error("Stripe checkout failed", json?.error?.message);
    return NextResponse.json({ error: "We couldn't start the card payment. Please try a bank transfer or try again." }, { status: 502 });
  }
  return NextResponse.json({ url: json.url });
}
