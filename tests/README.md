# iConfam E2E Test Suite

Real end-to-end tests using Playwright — they drive an actual browser against a
real running instance of the app, backed by a real Supabase project. Nothing
here is mocked.

## What's covered

- **`auth.spec.ts`** — the role gateway, nav sign-in routing, the quiet staff
  footer links, wrong-password handling, and role-based redirect/gating for
  all four roles (a client can't reach `/admin`, an agent can't reach
  `/portal`, etc.)
- **`admin.spec.ts`** — dashboard (kanban + analytics charts), All Cases,
  opening a case, adding a milestone and changing its status, logging and
  marking a payment paid, the invite form, and a regression test for the
  internal-notes data-loss bug that was found and fixed during this testing
  pass.
- **`client.spec.ts`** — My Cases, Case Detail (milestone labels, Documents
  and Payments sections), sending a message, and a regression test for the
  "stuck on Loading forever" bug on an invalid/unauthorized case ID.
- **`agent.spec.ts`** — My Assigned Cases, submitting a report, and the
  professional-only document upload field (confirms it's present for a
  professional account and absent for a field agent account).
- **`signup.spec.ts`** — real client self-signup: creates its own throwaway
  account (not the shared seed data, since signup is specifically about an
  account that doesn't exist yet), confirms the form never offers a role
  selector, and checks password-mismatch validation. Cleans up after itself.

## One-time setup

1. **Use a staging Supabase project, not production.** The suite creates and
   deletes real auth users (`e2e-admin@iconfam.test`, etc.) and a real case
   on every run. If you only have one Supabase project, that's fine — the
   teardown cleans up after itself — but be aware of that before running it
   against anything with real client data.
2. Run the schema migrations (`supabase/migrations/`) against that project if
   you haven't already, including `0002_scoped_storage_policies.sql`.
3. Copy the env example and fill in real values:
   ```
   cp tests/.env.test.example .env.test.local
   ```
4. Install Playwright's browser binary (one-time, downloads from Playwright's
   own CDN — this needs real network access, which may not be available in
   every sandboxed environment):
   ```
   npx playwright install chromium
   ```

## Running the tests

In one terminal, run the app against the same Supabase project your test env
points at:
```
npm run dev
```
In another terminal:
```
npm run test:e2e
```
Or, to watch it run and step through interactively:
```
npm run test:e2e:ui
```

## How seeding works

`tests/setup/global-setup.ts` runs once before any spec, using the service
role key to create four real accounts (admin/client/agent/professional) and
one real case with two milestones, then writes their IDs to
`tests/setup/seed-data.json` (gitignored) so every spec file can reference
the same real data. `tests/setup/global-teardown.ts` deletes all of it after
the run — deleting the case cascades to its milestones, reports, media,
documents, and payments automatically (defined that way in the schema).

## Why not run these automatically as part of the build

They need a live backend and a live app instance to test against — neither
exists at `npm run build` time. Run them separately, ideally against a
staging deployment, before trusting a change that touches auth, RLS, or any
of the three role flows.
