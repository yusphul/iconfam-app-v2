import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderEmail } from "@/lib/email/templates";
import { sendWithResend } from "@/lib/email/send";
import { appUrl } from "@/lib/email/config";

// This route uses the service role key (server-side only; it never reaches the
// browser). It invites a new person (agent/professional/client) by email using
// a one-time "set your password" link sent from iConfam's own email — we never
// generate or share a password ourselves.
// The matching public.users profile row is created automatically by the
// on_auth_user_created trigger (see supabase/migrations/0003_client_self_signup.sql)
// reading the metadata passed to createUser below — this route does NOT
// insert into public.users directly anymore, since that would race the trigger
// and fail on a duplicate primary key. Callable only by an admin.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Server is missing Supabase configuration." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const callerToken = authHeader.replace("Bearer ", "");
  if (!callerToken) {
    return NextResponse.json({ error: "Missing authorization." }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Confirm the caller is a signed-in admin before doing anything privileged.
  const { data: callerUser, error: callerError } = await adminClient.auth.getUser(callerToken);
  if (callerError || !callerUser?.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }
  const { data: callerProfile } = await adminClient
    .from("users")
    .select("role")
    .eq("id", callerUser.user.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can invite users." }, { status: 403 });
  }

  const body = await req.json();
  const { full_name, email, whatsapp_number, role, region, country, specialty } = body;

  if (!full_name || !email || !role) {
    return NextResponse.json(
      { error: "full_name, email, and role are required." },
      { status: 400 }
    );
  }

  // Professionals are invited as a specific kind (lawyer, surveyor, ...). The
  // database enforces the same list; checking here gives a readable error.
  const SPECIALTIES = [
    "lawyer",
    "surveyor",
    "architect",
    "structural_engineer",
    "quantity_surveyor",
    "estate_valuer",
    "town_planner",
    "agronomist",
    "other",
  ];
  if (role === "professional" && !SPECIALTIES.includes(specialty)) {
    return NextResponse.json(
      { error: "Choose a specialty for this professional." },
      { status: 400 }
    );
  }

  // The person is created here and the "set your password" link is sent from OUR
  // email system (same sender and look as every other iConfam email), not by
  // Supabase's separate invite mail. The profile row is still created by the
  // on_auth_user_created trigger from the metadata below.
  const redirectTo = `${req.nextUrl.origin}/set-password`;
  const cleanEmail = String(email).trim().toLowerCase();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: cleanEmail,
    email_confirm: true,
    user_metadata: {
      full_name,
      whatsapp_number: whatsapp_number ?? null,
      role,
      region: region ?? null,
      country: country ?? null,
      specialty: role === "professional" ? specialty : null,
    },
  });
  if (createError || !created?.user) {
    const exists = /already|registered|exists/i.test(createError?.message ?? "");
    return NextResponse.json(
      { error: exists ? "Someone with that email already has an account." : (createError?.message ?? "Could not create the account.") },
      { status: 400 }
    );
  }

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: cleanEmail,
    options: { redirectTo },
  });
  const link = linkData?.properties?.action_link;
  if (linkError || !link) {
    return NextResponse.json({
      ok: true,
      userId: created.user.id,
      emailed: false,
      error: "The account was created but we couldn't make a sign-in link. Use \"Forgot password\" on the sign-in page.",
    });
  }

  const mail = renderEmail(
    { kind: "invite", to_name: full_name, payload: { role, link } },
    { appUrl: appUrl(req.nextUrl.origin), timezone: "UTC" }
  );
  const sent = mail
    ? await sendWithResend({ to: cleanEmail, ...mail })
    : { ok: false as const, error: "no template" };

  return NextResponse.json({
    ok: true,
    userId: created.user.id,
    emailed: sent.ok,
    // If email isn't set up yet (or failed), hand the admin the link so they can
    // pass it on themselves. It is single-use and expires.
    ...(sent.ok ? {} : { inviteLink: link }),
  });
}
