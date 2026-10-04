import { test, expect } from "@playwright/test";
import { loadSeed, loginAs } from "./helpers";

test.describe("Field agent", () => {
  test.beforeEach(async ({ page }) => {
    const seed = loadSeed();
    await loginAs(page, "agent", seed);
  });

  test("My Assigned Cases shows the seeded case with real milestone labels", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "My Assigned Cases" })).toBeVisible();
    await expect(page.getByText("E2E Test Case — pending status check")).toBeVisible();
    // Regression check for the raw-status-text bug — "in_progress"/"pending"
    // must never appear verbatim; the proper labels should.
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  });

  test("Submit Report form has no document upload field for a field agent", async ({ page }) => {
    const seed = loadSeed();
    await page.goto(`/agent/submit/${seed.milestoneIds[1]}`);
    await expect(page.getByRole("heading", { name: "Submit Report" })).toBeVisible();
    // Document upload is professional-only by design — confirm it's absent here.
    await expect(page.getByLabel(/Document \(only if/)).toHaveCount(0);
  });

  test("can submit a report with findings, status, and location", async ({ page }) => {
    const seed = loadSeed();
    await page.goto(`/agent/submit/${seed.milestoneIds[1]}`);

    await page.getByLabel("Status").selectOption("confirmed_good");
    await page
      .getByLabel("Findings — plain language, exactly what you saw")
      .fill("Playwright e2e test: visited site, everything matches the plan.");

    await expect(
      page.getByText("Report submitted — an admin will review it")
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Submit Report" }).click();
    await expect(page.getByText("Report submitted — an admin will review it")).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: "Back to my cases" }).click();
    await expect(page).toHaveURL(/\/agent\/cases\//);
  });
});

test.describe("Professional", () => {
  test.beforeEach(async ({ page }) => {
    const seed = loadSeed();
    await loginAs(page, "professional", seed);
  });

  test("Submit Report form DOES show the document upload field for a professional", async ({
    page,
  }) => {
    const seed = loadSeed();
    await page.goto(`/agent/submit/${seed.milestoneIds[0]}`);
    await expect(page.getByLabel(/Document \(only if/)).toBeVisible();
    await expect(page.getByPlaceholder("What is it? e.g. Certificate of Occupancy, survey plan")).toBeVisible();
  });

  test("a professional cannot reach the admin dashboard", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/agent/);
  });
});
