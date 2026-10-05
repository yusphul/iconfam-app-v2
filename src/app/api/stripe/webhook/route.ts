import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { runOutbox } from "@/lib/email/run";

// Stripe tells us a card payment succeeded. We verify the signature ourselves
// (no SDK needed), check the amount matches the invoice, then mark it paid with
// the service-role key. Idempotent: replays do nothing once the invoice is paid.

function verify(payload: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i), kv.slice(i + 1)];
    })
  );
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  const given = String(parts.v1 ?? "");
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured." }, { status: 501 });

  const payload = await req.text();
  if (!verify(payload, req.headers.get("stripe-signature") ?? "", secret)) {
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  const event = JSON.parse(payload);
  if (event.type !== "checkout.session.completed") return NextResponse.json({ ok: true });
  const session = event.data?.object;
  if (session?.payment_status !== "paid") return NextResponse.json({ ok: true });

  const paymentId = session.metadata?.payment_id;
  if (!paymentId) return NextResponse.json({ ok: true });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: pay } = await admin.from("payments").select("id, amount, currency, status").eq("id", paymentId).maybeSingle();
  if (!pay || pay.status === "paid") return NextResponse.json({ ok: true });
  if (pay.currency !== "USD" || session.amount_total !== Math.round(Number(pay.amount) * 100)) {
    console.error("Stripe amount mismatch for payment", paymentId);
    return NextResponse.json({ error: "Amount mismatch." }, { status: 400 });
  }
  const { error } = await admin
    .from("payments")
    .update({ status: "paid", method: "card", external_id: session.id, client_reference: session.payment_intent ?? null })
    .eq("id", paymentId);
  if (error) {
    console.error("Could not mark payment paid", error.message);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
  // The database queued a receipt for the client; send it now.
  try {
    await runOutbox(req.nextUrl.origin, 10);
  } catch (e) {
    console.error("sending receipt failed", e);
  }
  return NextResponse.json({ ok: true });
}
