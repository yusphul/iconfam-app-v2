# iConfam — Application

Web app implementing the Admin View, Agent/Professional Submission Portal, and Client
Portal from `iConfam-Application-Spec.md`. Built with Next.js (App Router), Supabase
(Postgres + Auth + Storage), and Tailwind CSS.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations **in order**:
   - `supabase/migrations/0001_init_schema.sql` — every table, enum, RLS policy, and
     storage bucket the app needs.
   - `supabase/migrations/0002_scoped_storage_policies.sql` — tightens file access in
     both storage buckets down to only the case a user actually has rights to, rather
     than "any logged-in user can read/write any file." Run this even if you already
     ran 0001 previously — it replaces the original, broader storage policies.
   - `supabase/migrations/0003_client_self_signup.sql` — adds a trigger that
     automatically creates a client's `public.users` profile row on signup. Required
     for the `/signup` page to work at all — without it, a self-signed-up account
     gets an auth login but no profile, and every page will fail to find them.
   - `supabase/migrations/0004_contact_messages.sql` — stores landing-page contact
     form submissions.
   - `supabase/migrations/0005_specialties_review_gate_threads.sql` — professional
     specialties (lawyer, surveyor, architect, …), several professionals per case,
     the **admin review gate** for reports and documents, **private message threads**
     (client ↔ admin, professional ↔ admin, agent ↔ admin), professionals adding
     milestones, and privilege/visibility fixes (see "Roles and who sees what" below).
     **Deploy order:** run this in the SQL editor first, then push the matching app
     code — the new app and the new schema depend on each other.
   - `supabase/migrations/0006_case_recommendations.sql` — iConfam's recommendation /
     summary for each case (a verdict, a plain-language summary and next steps). It is
     a draft until an admin publishes it; clients only ever see published ones, and
     professionals and field agents never see them. Run after 0005, then push the code.
3. In Project Settings → API, copy the **Project URL**, **anon public key**, and
   **service_role key**.
4. Create your own first admin account:
   - In Authentication → Users, click "Add user", create yourself with an email + password.
   - In the SQL editor, insert your profile row (replace the UUID with the one Supabase
     just generated for you, visible in the Users list):
     ```sql
     insert into public.users (id, full_name, email, role)
     values ('paste-your-auth-user-id-here', 'Your Name', 'you@example.com', 'admin');
     ```
   This manual first-admin step is a one-time thing — every user after this is created
   through the app's own "Invite" flow in Agents & Professionals (which also handles
   clients), using the service role key server-side.

## 2. Configure environment variables

```
cp .env.example .env.local
```

Fill in the three values from step 1.3. `SUPABASE_SERVICE_ROLE_KEY` is only ever read by
`src/app/api/admin/invite-user/route.ts`, which runs on the server — it is never sent to
the browser. Keep it out of version control (`.env.local` is already gitignored).

## 2b. Email notifications (Resend)

The app emails the people involved whenever something happens (a request, a booked
call, a quote, a payment, a new report, a message...). Database triggers queue each
email; the server sends them through [Resend](https://resend.com).

1. Create a Resend account, add and verify your sending domain (it gives you DNS records).
2. Create an API key and set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`,
   `NEXT_PUBLIC_SITE_URL` and `CRON_SECRET` in Vercel (see `.env.example`).
3. Run `supabase/migrations/0007_*.sql`, then `0008_email_notifications.sql`, then
   `0009_visit_pricing_quote_lines.sql` in the SQL editor.
4. Daily call reminders run from `vercel.json` (`/api/cron/reminders`).

New people (clients, agents, professionals) are invited with a one-time "set your
password" link sent from this same email system. Optional: in Supabase, Authentication,
SMTP Settings, use Resend's SMTP details so Supabase's own emails (password reset) come
from the same sender. Admin, Settings shows the most recent emails and any errors.

## 3. Install and run

```
npm install
npm run dev
```

Visit `http://localhost:3000`, sign in with the admin account from step 1.4, and you'll
land on `/admin`.

## 4. Required: configure Supabase Auth redirect URLs

The invite flow (Section 6 below) sends people a real email with a link back into the
app to set their password. Supabase blocks redirects to URLs it doesn't recognize, so
before inviting anyone:

1. Supabase dashboard → Authentication → URL Configuration.
2. Set **Site URL** to your deployed app's URL (e.g. `https://app.iconfam.com`, or your
   `*.vercel.app` URL while testing).
3. Under **Redirect URLs**, add `https://<your-domain>/**` (and, while testing on
   Vercel's preview URLs too, `https://*.vercel.app/**`).

Skip this and invite emails will still send, but clicking the link will fail or land
somewhere unexpected.

**Also worth knowing:** Supabase's built-in email sending (used for invites) is meant
for low-volume testing — it's rate-limited and can land in spam. Before inviting real
clients or professionals at any volume, configure a custom SMTP provider under
Authentication → Settings → SMTP Settings (Resend and Postmark are both simple to set
up) so delivery is reliable.

## 5. Client self-signup

`/signup` lets a prospective client create their own account — no admin action
needed. This is what an ad campaign should link to. The form never collects or
offers a role, so a self-signup can only ever create a `client` account; agents,
professionals, and admins are still invite-only (Section 4 above still applies to
them). After signing up, a client lands on `/portal/new` to describe what they
need verified, which creates a real case with status `intake` for you to pick up
in the admin dashboard — no case exists until they've told you what they need.

## 6. What's built vs. what's next

**Built (all three surfaces from the spec, functional against a real Supabase backend):**
- **Public landing page** (`/`, shown to signed-out visitors) — a survey/blueprint-themed
  page: nav, hero, "What we do," a client-focused sign-in/sign-up section with a phone
  mockup, testimonials, contact, and a footer. Field agent, professional, and admin
  sign-in are deliberately not featured here — they're a quiet row of links in the
  footer's bottom bar, since those are internal team members, not something a
  prospective client should be choosing between.
- **Client self-signup** (`/signup`) — enrolls a new client with no admin involvement,
  landing them straight on `/portal/new` to describe what they need verified.
- Admin: Dashboard (kanban by status, plus a "Cases by status," "Cases by type," and
  milestone-timeline analytics section), All Cases, Case Detail (milestones with a real
  status control, report approval gate, payments, documents, internal notes, messages),
  Agents & Professionals directory with invite flow and a same-relationship reassignment
  warning, Payments overview, and the Review Queue for approving or rejecting reports and documents.
- Agent/Professional portal: My Assigned Cases, Submit Report (camera capture,
  geolocation, blunt status flag, professional-only document upload).
- Client portal: My Cases (with a "+ Request verification" entry point), Case Detail
  (milestone timeline, published reports with photo evidence, documents, payments,
  messages), and the self-serve case-request form.
- **Invite flow sends a real email.** Inviting someone from Agents & Professionals uses
  Supabase's built-in invite-by-email — they get an email with a link to `/set-password`
  to choose their own password. Nothing is generated or shared manually. The matching
  `public.users` profile row — for both invited staff and self-signed-up clients — is
  created automatically by a database trigger (`0003_client_self_signup.sql`), not by
  application code.

**Deliberately not built yet, per the spec's own sequencing (Section 14) and revenue
model (Section 11):**
- Payment processor integration (Paystack/Flutterwave) — v1 is manual, admin marks
  payments paid after confirming a bank transfer.
- WhatsApp/email notifications (Twilio) — the data model supports logging a message's
  channel, but nothing sends one automatically yet. Requires WhatsApp Business API
  approval from Meta first (start that application early — it can take days to weeks).
- AI-assisted computer-vision cross-checks, cost-anomaly detection, satellite/NDVI data —
  these were scoped as a v2 differentiator, not part of this initial build.

## Roles and who sees what

- **Client** sees only their own cases, and only reports and documents an admin has
  *approved and shared with the client*. Staff appear as role labels ("Lawyer",
  "Field agent"), never by name. Messages are a private thread with the iConfam team.
- **Field agent / professional** see only cases they're assigned to and their own
  submissions (plus anything the admin approves for the case team). A professional
  can add milestones and submit reports and documents. Their only line of
  communication is a private thread with the **admin**; they can't read or write to the
  client, and the client can't see them.
- **Admin** sees everything and is the second pair of eyes: every report and
  document starts as *Awaiting review*. The admin approves it (choosing whether to
  share with the client, the case team, or both), or rejects it with a note that is
  sent back to the submitter. The Review Queue shows everything waiting.
- **Recommendation and PDF report:** on each case the admin writes a verdict
  (Proceed / Proceed with caution / Do not proceed / Inconclusive), a summary and
  next steps, and publishes it when ready. The client sees it at the top of the case,
  can fold the "Steps & reports" section and each step, and can download a standard
  PDF report (cover, case details, recommendation, steps table, findings with photos,
  documents, notice). The PDF is built in the browser from what the client can already
  see, so it can never contain more than the page does.
- **Assigning professionals:** from the case page, pick a specialty, then a person;
  a case can have several (e.g. a lawyer and a surveyor).
- **Status colours** are the same for every role: grey = not started, indigo = scoped,
  blue = in progress, amber = needs action, green = done/approved, violet = on hold,
  red = problem/rejected/overdue.

## 7. Testing

A real Playwright E2E suite lives in `tests/` — it seeds real accounts and a real
case into your Supabase project and drives the actual UI as each role. See
`tests/README.md` for setup and how to run it. Run it against a staging Supabase
project, not production, since it creates and deletes real data on every run.

## 8. Known limitations, going into real use

- Invited users set their own password via the emailed link (Supabase's built-in
  invite flow) — there's no temporary password to communicate manually anymore.
  Supabase's default email sending is rate-limited and can land in spam; configure
  a real SMTP provider (Resend, Postmark) in Authentication → Settings before
  inviting real clients at any volume — see Section 4 above.
- Error handling across the app is mostly "fail quiet, show an empty state" rather
  than surfacing a specific error message — reasonable for early use, worth
  hardening if a network failure needs to be visibly distinguishable from "there's
  genuinely nothing here" later on.
- WhatsApp/email notifications (Section 5) and client self-serve case requests are
  still not built, as noted above.

## Pricing

Property verification and documentation are quoted by hand after the intake call.
Site inspection and farm oversight are priced per visit:

    price = iConfam service fee + field costs (agent wage + transport + data)

Set the service fee (default USD 60 per visit) and the naira field costs for each
distance zone in **Admin, Settings, Visit pricing**. On a lead for one of those two
services the quote builder converts the naira costs to dollars at the naira rate
from the same page, shows the itemised lines, and asks for the full amount up front.
