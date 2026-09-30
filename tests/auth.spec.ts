import { test, expect } from "@playwright/test";
import { loadSeed, loginAs, userByRole } from "./helpers";

test.describe("Auth & role gating", () => {
  test("logged-out visitor sees the role gateway, not a bare login form", async ({ page }) => {
    await page.goto("/");
    // The heading spans three lines via <br/>, so match on a distinctive
    // substring rather than the exact full string — safer than assuming
    // exactly how the browser normalizes the line-break whitespace.
    await expect(page.getByRole("heading", { name: /Confam Am\./ })).toBeVisible();
    // The "Sign in" section's primary path is now self-serve signup (for ad
    // traffic), with sign-in as a secondary option for returning clients —
    // and the internal roles must not be advertised there at all. (They do
    // exist elsewhere, quietly, in the footer — see the next test.)
    const signInSection = page.locator("#signin");
    await expect(signInSection.getByRole("link", { name: "Get started" })).toBeVisible();
    await expect(
      signInSection.getByRole("link", { name: "Already have an account? Sign in" })
    ).toBeVisible();
    await expect(signInSection.getByRole("link", { name: "Field agent" })).toHaveCount(0);
  });

  test("nav Sign in goes straight to the client login page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Sign in" }).first().click();
    await expect(page).toHaveURL(/\/login\?role=client/);
    await expect(page.getByRole("heading", { name: "Sign in as a client" })).toBeVisible();
  });

  test("staff sign-in links are present but only in the quiet footer row", async ({ page }) => {
    await page.goto("/");
    const footerAgentLink = page.locator("footer").getByRole("link", { name: "Field agent" });
    await expect(footerAgentLink).toBeVisible();
    await footerAgentLink.click();
    await expect(page).toHaveURL(/\/login\?role=agent/);
  });

  test("wrong password shows an error and does not navigate away", async ({ page }) => {
    const seed = loadSeed();
    const client = userByRole(seed, "client");
    await page.goto("/login?role=client");
    await page.getByLabel("Email").fill(client.email);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/invalid|incorrect/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("visiting a protected route while logged out redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  for (const role of ["admin", "client", "agent", "professional"] as const) {
    test(`${role} login redirects to the correct workspace`, async ({ page }) => {
      const seed = loadSeed();
      await loginAs(page, role, seed);
      const expectedPath =
        role === "admin" ? "/admin" : role === "client" ? "/portal" : "/agent";
      await expect(page).toHaveURL(new RegExp(expectedPath));
    });
  }

  test("a client cannot reach the admin dashboard by URL", async ({ page }) => {
    const seed = loadSeed();
    await loginAs(page, "client", seed);
    await page.goto("/admin");
    // RequireRole bounces an unauthorized role back to "/", which then
    // redirects a logged-in client on to their own workspace.
    await expect(page).toHaveURL(/\/portal/);
  });

  test("an agent cannot reach the client portal by URL", async ({ page }) => {
    const seed = loadSeed();
    await loginAs(page, "agent", seed);
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/agent/);
  });
});
