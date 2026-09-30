import { Page, expect } from "@playwright/test";
import { readFileSync } from "fs";
import path from "path";

export interface SeedData {
  password: string;
  users: { email: string; full_name: string; role: string; id: string }[];
  caseId: string;
  milestoneIds: string[];
}

export function loadSeed(): SeedData {
  const seedPath = path.join(__dirname, "setup", "seed-data.json");
  return JSON.parse(readFileSync(seedPath, "utf-8"));
}

export function userByRole(seed: SeedData, role: string) {
  const user = seed.users.find((u) => u.role === role);
  if (!user) throw new Error(`No seeded user with role "${role}"`);
  return user;
}

/** Logs in through the real UI (not a shortcut) so auth + redirect logic is
 * actually exercised, then waits for the post-login redirect to land. */
export async function loginAs(page: Page, role: string, seed: SeedData) {
  const user = userByRole(seed, role);
  await page.goto(`/login?role=${role}`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(seed.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
}
