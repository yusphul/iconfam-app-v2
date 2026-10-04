import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This route is the ONLY place the service role key is used — it never reaches the
// browser. It invites a new person (agent/professional/client) by email using
// Supabase's built-in invite flow: Supabase sends them a real email with a link that
// lets them set their own password — we never generate or share a password ourselves.
// The matching public.users profile row is created automatically by the
// on_auth_user_created trigger (see supabase/migrations/0003_client_self_signup.sql)
// reading the metadata passed to inviteUserByEmail below — this route does NOT
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

  // req.nextUrl.origin matches wherever this is actually running — localhost while
  // developing, a Vercel preview URL, or app.iconfam.com once that's attached —
  // so the invite link always sends people back to the right place.
  const redirectTo = `${req.nextUrl.origin}/set-password`;

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo,
      data: {
        full_name,
        whatsapp_number: whatsapp_number ?? null,
        role,
        region: region ?? null,
        country: country ?? null,
        specialty: role === "professional" ? specialty : null,
      },
    }
  );
  if (inviteError || !invited?.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? "Failed to send the invite email." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, userId: invited.user.id });
}
