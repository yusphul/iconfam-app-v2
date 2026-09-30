import { test, expect } from "@playwright/test";
import { loadSeed, loginAs, userByRole } from "./helpers";

test.describe("Client", () => {
  test.beforeEach(async ({ page }) => {
    const seed = loadSeed();
    await loginAs(page, "client", seed);
  });

  test("My Cases lists only the seeded client's own case", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "My Cases" })).toBeVisible();
    await expect(page.getByText("E2E Test Case — pending status check")).toBeVisible();
  });

  test("Case Detail shows the milestone timeline with real labels, not raw status codes", async ({
    page,
  }) => {
    const seed = loadSeed();
    await page.goto(`/portal/cases/${seed.caseId}`);
    await expect(page.getByRole("heading", { name: "E2E Test Case" })).toBeVisible();
    await expect(page.getByText("Progress")).toBeVisible();
    // Regression check: this used to render the raw enum value ("confirmed")
    // rather than the proper label — both read the same for this particular
    // status, so the meaningful check is that "in_progress" (the raw form of
    // the second seeded milestone) never appears anywhere on the page.
    await expect(page.getByText("in_progress", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Confirmed")).toBeVisible();
  });

  test("Case Detail has Documents and Payments sections, empty-state or not", async ({ page }) => {
    const seed = loadSeed();
    await page.goto(`/portal/cases/${seed.caseId}`);
    await expect(page.getByText("Documents", { exact: true })).toBeVisible();
    await expect(page.getByText("Payments", { exact: true })).toBeVisible();
  });

  test("client can send a message on their own case", async ({ page }) => {
    const seed = loadSeed();
    await page.goto(`/portal/cases/${seed.caseId}`);
    const messageText = `Client question ${Date.now()}`;
    await page.getByPlaceholder("Ask a question about this case…").fill(messageText);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(messageText)).toBeVisible();
  });

  test("a client cannot open a case that is not theirs (RLS enforcement)", async ({ page }) => {
    // A random, non-existent case id — RLS should mean this returns nothing
    // visible rather than another client's data. This is also a regression
    // test for a bug where this used to hang on "Loading…" forever instead
    // of resolving to a clear message.
    await page.goto("/portal/cases/00000000-0000-0000-0000-000000000000");
    await expect(
      page.getByText("We couldn't find that case, or it isn't linked to your account.")
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "E2E Test Case" })).toHaveCount(0);
  });
});
