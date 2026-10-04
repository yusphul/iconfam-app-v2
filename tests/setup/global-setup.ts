import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import path from "path";

// Creates four real Supabase Auth accounts (one per role) and one real case with
// two milestones, using the service role key — the same key the app's own
// /api/admin/invite-user route uses. This never runs in the browser and never
// ships to the deployed app; it only runs on your machine (or CI) before tests.
//
// Required env vars — see tests/README.md:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   E2E_TEST_PASSWORD (shared password for all four seeded accounts)

const SEED_FILE = path.join(__dirname, "seed-data.json");
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "IconfamTest!2026";

const TEST_USERS = [
  { email: "e2e-admin@iconfam.test", full_name: "E2E Admin", role: "admin" },
  { email: "e2e-client@iconfam.test", full_name: "E2E Client", role: "client" },
  { email: "e2e-agent@iconfam.test", full_name: "E2E Field Agent", role: "agent" },
  { email: "e2e-professional@iconfam.test", full_name: "E2E Professional", role: "professional" },
] as const;

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Copy tests/.env.test.example to .env.test.local and fill in real values " +
        "from a Supabase project you're comfortable seeding test data into — " +
        "never your production project."
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userIds: Record<string, string> = {};

  for (const u of TEST_USERS) {
    // Clean up a leftover user from a previous failed run, if any, so re-running
    // setup is idempotent rather than erroring on "email already exists."
    const { data: existingList } = await admin.auth.admin.listUsers();
    const existing = existingList?.users.find((x) => x.email === u.email);
    if (existing) {
      await admin.from("users").delete().eq("id", existing.id);
      await admin.auth.admin.deleteUser(existing.id);
    }

    // full_name/role/region go in user_metadata, not a separate insert — the
    // on_auth_user_created trigger (0003_client_self_signup.sql) creates the
    // matching public.users row automatically from this metadata. Doing a
    // second manual insert here would race the trigger and fail on a
    // duplicate primary key, the same issue fixed in the invite-user route.
    const { data: created, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: u.full_name,
        role: u.role,
        region: "Lagos",
        // Professionals are a specific kind; the seeded one is a lawyer.
        specialty: u.role === "professional" ? "lawyer" : null,
      },
    });
    if (error || !created?.user) {
      throw new Error(`Failed to create seed user ${u.email}: ${error?.message}`);
    }
    userIds[u.role] = created.user.id;
  }

  // One real case, assigned to the seeded agent and professional, owned by the
  // seeded client, with two milestones in different states.
  const { data: testCase, error: caseError } = await admin
    .from("cases")
    .insert({
      title: "E2E Test Case — pending status check",
      case_type: "status_verification",
      client_id: userIds.client,
      assigned_agent_id: userIds.agent,
      status: "in_progress",
      location_description: "Seeded by Playwright global setup",
    })
    .select()
    .single();
  if (caseError || !testCase) {
    throw new Error(`Failed to create seed case: ${caseError?.message}`);
  }

  // Professionals are linked through case_professionals (a case can have several).
  const { error: linkError } = await admin
    .from("case_professionals")
    .insert({ case_id: testCase.id, professional_id: userIds.professional });
  if (linkError) {
    throw new Error(`Failed to assign seed professional: ${linkError.message}`);
  }

  const { data: milestones, error: milestoneError } = await admin
    .from("milestones")
    .insert([
      { case_id: testCase.id, name: "Confirm file exists at registry", sequence_order: 1, status: "confirmed" },
      { case_id: testCase.id, name: "Confirm processing status", sequence_order: 2, status: "pending" },
    ])
    .select();
  if (milestoneError || !milestones) {
    throw new Error(`Failed to create seed milestones: ${milestoneError?.message}`);
  }

  // A published recommendation, so the client case page always has one to show.
  const { error: recError } = await admin.from("case_recommendations").insert({
    case_id: testCase.id,
    verdict: "proceed_with_caution",
    summary: "E2E recommendation summary: the file checks out, but confirm the boundaries.",
    next_steps: "1. Confirm the boundaries with a surveyor.",
    published: true,
  });
  if (recError) {
    throw new Error(`Failed to create seed recommendation: ${recError.message}`);
  }

  // Persist everything the specs need so they don't have to re-derive IDs.
  writeFileSync(
    SEED_FILE,
    JSON.stringify(
      {
        password: TEST_PASSWORD,
        users: TEST_USERS.map((u) => ({ ...u, id: userIds[u.role] })),
        caseId: testCase.id,
        milestoneIds: milestones.map((m) => m.id),
      },
      null,
      2
    )
  );
}
