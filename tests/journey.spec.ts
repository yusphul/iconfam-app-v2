import "dotenv/config";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadSeed, loginAs, userByRole } from "./helpers";

// The whole client journey in one story: someone shows interest, books an intake
// call, the admin scopes and quotes, the client is told to pay, and work stays
// locked until the deposit is confirmed.
test.describe.serial("Client journey: interest -> call -> quote -> deposit", () => {
  const seed = loadSeed();
  const client = userByRole(seed, "client");
  const summary = `E2E journey ${Date.now()}`;

  test.afterAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const admin = createClient(url, key);
    const { data: leads } = await admin.from("leads").select("id, converted_case_id").eq("summary", summary);
    for (const l of leads ?? []) {
      if (l.converted_case_id) await admin.from("cases").delete().eq("id", l.converted_case_id);
      await admin.from("leads").delete().eq("id", l.id);
    }
  });

  test("a visitor shows interest and books a call", async ({ page }) => {
    await page.goto("/start");
    await page.getByLabel("Your name").fill(client.full_name);
    await page.getByLabel("Email").fill(client.email);
    await page.getByLabel("Short description").fill(summary);
    await page.waitForTimeout(3300); // the form's anti-bot minimum time on page
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page).toHaveURL(/\/book\//, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Pick a time to talk/ })).toBeVisible();
    await page.getByText("30 minutes", { exact: true }).click();
    // first open time on the first open day
    await page.getByRole("radiogroup", { name: "Time" }).getByRole("radio").first().click();
    await page.getByRole("button", { name: /^Book / }).click();
    await expect(page.getByRole("heading", { name: "Your call is booked" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add to Google Calendar" })).toBeVisible();
  });

  test("the admin sees the lead, then scopes and quotes it", async ({ page }) => {
    await loginAs(page, "admin", seed);
    await page.goto("/admin/leads");
    await page.getByRole("link", { name: client.full_name }).first().click();
    await expect(page.getByText(summary)).toBeVisible();
    await expect(page.getByText("Call booked")).toBeVisible();

    await page.getByLabel("Total fee").fill("1000");
    await expect(page.getByText(/Deposit due now/)).toContainText("500");
    await page.getByRole("button", { name: "Create case and send quote" }).click();
    await expect(page).toHaveURL(/\/admin\/cases\//, { timeout: 15000 });
    await expect(page.getByText("Waiting for the initial deposit.")).toBeVisible();

    // Work is locked until the deposit clears.
    await page.getByLabel("Status", { exact: true }).selectOption("in_progress");
    await expect(page.getByRole("alert")).toContainText(/deposit/i);
  });

  test("the client is told to pay, reports a transfer, admin confirms, work unlocks", async ({ page, browser }) => {
    await loginAs(page, "client", seed);
    await page.goto("/portal");
    await page.getByRole("link", { name: new RegExp(summary) }).click();
    await expect(page.getByRole("heading", { name: "Pay your deposit to start" })).toBeVisible();
    await page.getByRole("button", { name: "Pay deposit" }).first().click();
    await expect(page.getByRole("tab", { name: /Bank transfer \(USD\)/ })).toBeVisible();
    await page.getByLabel(/transfer reference/).fill("E2E-REF-1234");
    // Disabled until the admin has entered bank details in Settings; that is the intended safeguard.
    const send = page.getByRole("button", { name: "I've sent the payment" });
    if (await send.isEnabled()) {
      await send.click();
      await expect(page.getByText(/confirming your transfer/)).toBeVisible();
    }

    // Admin confirms and the lock opens.
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, "admin", seed);
    await adminPage.goto("/admin/leads");
    await adminPage.getByRole("tab", { name: /Quoted/ }).click();
    await adminPage.getByRole("link", { name: client.full_name }).first().click();
    await adminPage.getByRole("button", { name: "Open the case" }).click();
    await adminPage.getByRole("button", { name: /Confirm received|Mark paid/ }).first().click();
    await adminPage.getByLabel("Status", { exact: true }).selectOption("in_progress");
    await expect(adminPage.getByRole("alert")).toHaveCount(0);
    await adminCtx.close();
  });
});
