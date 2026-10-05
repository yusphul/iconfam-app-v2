import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runOutbox } from "@/lib/email/run";

// Runs once a day (see vercel.json). Queues reminders for calls in the next 25
// hours, then sends everything waiting, which also retries anything that failed.
// Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: queued, error } = await supabaseAdmin().rpc("enqueue_call_reminders");
  if (error) {
    console.error("enqueue_call_reminders failed", error.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  const sent = await runOutbox(req.nextUrl.origin, 100);
  return NextResponse.json({ reminders: queued, ...sent });
}
