import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, unlinkSync } from "fs";
import path from "path";

const SEED_FILE = path.join(__dirname, "seed-data.json");

export default async function globalTeardown() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey || !existsSync(SEED_FILE)) return;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const seed = JSON.parse(readFileSync(SEED_FILE, "utf-8"));

  // Deleting the case cascades to milestones, reports, media, documents,
  // payments, and messages (all defined with "on delete cascade").
  if (seed.caseId) {
    await admin.from("cases").delete().eq("id", seed.caseId);
  }
  for (const u of seed.users ?? []) {
    await admin.from("users").delete().eq("id", u.id);
    await admin.auth.admin.deleteUser(u.id);
  }

  unlinkSync(SEED_FILE);
}
