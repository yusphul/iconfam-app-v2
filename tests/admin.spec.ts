import { test, expect } from "@playwright/test";
import { loadSeed, loginAs } from "./helpers";

test.describe("Admin", () => {
  test.beforeEach(async ({ page }) => {
    const seed = loadSeed();
    await loginAs(page, "admin", seed);
  });

  test("dashboard shows the kanban board and the analytics section", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    // The seeded case is "in_progress" — confirm it shows up in that column.
    await expect(page.getByText("E2E Test Case — pending status check")).toBeVisible();
    await expect(page.getByText("Cases by status")).toBeVisible();
    await expect(page.getByText("Cases by type")).toBeVisible();
    await expect(page.getByText("Milestone timeline — open cases")).toBeVisible();
  });

  test("can open the seeded case from the dashboard and reach Case Detail", async ({ page }) => {
    await page.getByRole("link", { name: "E2E Test Case — pending status check" }).click();
    await expect(page).toHaveURL(/\/admin\/cases\//);
    await expect(page.getByRole("heading", { name: "E2E Test Case" })).toBeVisible();
  });

  test("All Cases table lists the seeded case and links to its detail page", async ({ page }) => {
    await page.goto("/admin/cases");
    await expect(page.getByRole("heading", { name: "All Cases" })).toBeVisible();
    await page.getByRole("link", { name: "E2E Test Case — pending status check" }).click();
    await expect(page).toHaveURL(/\/admin\/cases\//);
  });

  test("can add a milestone and change its status", async ({ page }) => {
    const seed = loadSeed();
    await page.goto(`/admin/cases/${seed.caseId}`);

    const milestoneName = `Playwright milestone ${Date.now()}`;
    await page.getByPlaceholder("e.g. Title & registry status check").fill(milestoneName);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(milestoneName)).toBeVisible();

    // Find the row for the milestone we just added and confirm its status.
    const row = page.locator("li", { hasText: milestoneName });
    const select = row.locator("select");
    await select.selectOption("confirmed");
    await expect(select).toHaveValue("confirmed");
  });

  test("internal notes survive an unrelated page action (regression test for the notes-clobbering bug)", async ({
    page,
  }) => {
    const seed = loadSeed();
    await page.goto(`/admin/cases/${seed.caseId}`);

    const noteText = `Do not lose this note — ${Date.now()}`;
    const notesBox = page.getByPlaceholder("Never shown to the client.");
    await notesBox.fill(noteText);

    // Trigger an unrelated reload-causing action WITHOUT blurring the notes
    // field first — this is exactly the sequence that used to wipe the note.
    const messageText = `Regression check message ${Date.now()}`;
    await page.getByPlaceholder("Send a message on this case…").fill(messageText);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(messageText)).toBeVisible();

    // The notes field must still contain what we typed.
    await expect(notesBox).toHaveValue(noteText);

    // Now actually blur and confirm the save persists across a full reload.
    await notesBox.blur();
    await page.reload();
    await expect(page.getByPlaceholder("Never shown to the client.")).toHaveValue(noteText);
  });

  test("can log a payment and mark it paid", async ({ page }) => {
    const seed = loadSeed();
    await page.goto(`/admin/cases/${seed.caseId}`);

    const description = `Test fee ${Date.now()}`;
    await page.getByPlaceholder("e.g. Status verification fee").fill(description);
    await page.getByPlaceholder("Amount (USD)").fill("150");
    await page.getByRole("button", { name: "Log payment" }).click();

    const row = page.locator("li", { hasText: description });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Mark paid" }).click();
    await expect(row.getByText("Paid")).toBeVisible();
  });

  test("Review Queue is reachable and the invite form on Agents & Professionals renders", async ({
    page,
  }) => {
    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();

    await page.goto("/admin/agents");
    await expect(page.getByRole("heading", { name: "Agents & Professionals" })).toBeVisible();
    await page.getByRole("button", { name: "+ Invite" }).click();
    await expect(page.getByPlaceholder("Full name")).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
  });
});
