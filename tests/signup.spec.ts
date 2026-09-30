import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// This spec creates its own throwaway account rather than using the shared
// seed data, since signup is specifically about an account that doesn't
// exist yet. It cleans up after itself via the service role key.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test.describe("Self-signup", () => {
  const testEmail = `e2e-signup-${Date.now()}@iconfam.test`;
  const testPassword = "IconfamSignupTest!2026";

  test.afterAll(async () => {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await admin.auth.admin.listUsers();
    const created = data?.users.find((u) => u.email === testEmail);
    if (created) {
      await admin.from("cases").delete().eq("client_id", created.id);
      await admin.from("users").delete().eq("id", created.id);
      await admin.auth.admin.deleteUser(created.id);
    }
  });

  test("a new client can create their own account with no role selection available", async ({
    page,
  }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    // The form must never expose a way to pick a role — self-signup can only
    // ever produce a client account.
    await expect(page.getByLabel(/role/i)).toHaveCount(0);

    await page.getByLabel("Full name").fill("E2E Signup Test");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password", { exact: true }).fill(testPassword);
    await page.getByLabel("Confirm password").fill(testPassword);
    await page.getByRole("button", { name: "Create account" }).click();

    // Depending on the project's email-confirmation setting, this either
    // lands straight in the request-verification flow (confirmation off)
    // or shows the "check your email" screen (confirmation on) — both are
    // valid, correct outcomes, so accept either rather than assuming one.
    await expect(
      page
        .getByRole("heading", { name: "Request verification" })
        .or(page.getByRole("heading", { name: "Check your email" }))
    ).toBeVisible({ timeout: 15000 });
  });

  test("passwords that don't match are rejected before any account is created", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Mismatch Test");
    await page.getByLabel("Email").fill(`e2e-mismatch-${Date.now()}@iconfam.test`);
    await page.getByLabel("Password", { exact: true }).fill("FirstPassword123");
    await page.getByLabel("Confirm password").fill("DifferentPassword456");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords don't match.")).toBeVisible();
  });
});
