import { NextRequest, NextResponse } from "next/server";
import { runOutbox } from "@/lib/email/run";

// Sends any emails waiting in the queue. The app calls this a moment after
// something happens (see supabaseClient.ts). It takes no input and can only
// send emails that the database has already queued, so it is safe to leave open;
// calling it repeatedly just finds nothing to do.
export async function POST(req: NextRequest) {
  try {
    const r = await runOutbox(req.nextUrl.origin);
    return NextResponse.json(r);
  } catch (e) {
    console.error("notification run failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
