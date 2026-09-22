# iConfam Full-Stack Verification Platform

Production-oriented Next.js + Supabase implementation of the iConfam independent verification workflow.

## Included
- Premium navy/gold responsive landing page
- Client self-signup/sign-in
- Client verification request workflow
- Client dashboard with case/payment/report visibility
- Field agent/professional assigned-work workspace
- Finding submission and admin review gate
- Admin case oversight, flat-fee quoting, assignment and report release
- PostgreSQL schema + Row Level Security (RLS)
- Anti-repeat verifier/outside-party assignment rule
- Private evidence storage bucket definition
- Health endpoint: `/api/health`

## 1. Supabase setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql` once.
3. In Authentication settings, configure your Site URL and redirect URLs for localhost and your Vercel domain.
4. Copy Project URL and anon key into `.env.local` using `.env.example`.
5. Create your own account through `/auth?mode=signup`, then run the single UPDATE in `supabase/bootstrap-admin.sql` with your email to promote that account to admin.
6. Invite/create staff deliberately; do **not** expose staff self-registration. Promote staff roles only through a trusted admin/service workflow.

## 2. Local run
```bash
npm install
cp .env.example .env.local
# fill in Supabase values
npm run dev
```

## 3. Vercel
Push this folder to GitHub, import the repository in Vercel, and add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` = your production URL

Then deploy. The service-role key is intentionally not required by the current browser/RLS implementation.

## Important production notes
- The database, not just the UI, enforces client isolation and verifier assignment visibility.
- Raw findings are hidden from clients. Only approved reports are client-readable.
- Pricing is stored as a flat verification fee. This code does not hold or transfer project/investment funds.
- The evidence bucket is private. Field agents/professionals can upload photo/video evidence; storage policies keep it non-public and limit reads to the submitter/admin.
- Add your preferred payment processor if you want online collection of iConfam's verification fee. Do not connect project purchase/build/investment funds to iConfam.
- Before real client use, add transactional email, audit logging, MFA for staff/admins, rate limiting, malware scanning for uploads, retention/deletion jobs for sensitive documents, and automated end-to-end tests against a staging Supabase project.

## Test checklist
1. Client signs up and can create a case.
2. Client cannot read another client's case (RLS).
3. Admin sets flat fee and assigns verifier.
4. Reusing same verifier + same outside party is rejected by DB trigger.
5. Verifier sees only assigned cases.
6. Verifier submits finding; client cannot see raw finding.
7. Admin approves finding and releases report.
8. Client can see approved report metadata on dashboard.
9. `/api/health` returns `{ ok: true }`.

## v2 visual + portal update
This build now uses image assets cropped from the approved iConfam design reference so the deployed landing page matches the approved navy/gold composition much more closely: hero photography, service imagery, project imagery, CTA imagery and logo treatment.

### Portal URLs
- Client / universal sign-in: `/auth`
- Client self-registration: `/auth?mode=signup`
- Admin sign-in: `/auth?portal=admin`
- Field agent / professional sign-in: `/auth?portal=staff`
- Client workspace: `/dashboard`
- Field agent workspace: `/field`
- Professional workspace: `/professional`
- Admin workspace: `/admin`

All staff use the same secure authentication form. After authentication the profile role controls the destination; typing an admin URL does not grant admin access.

### Required Vercel environment variables
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

`SUPABASE_SERVICE_ROLE_KEY` is server-only and is used by the authenticated admin invitation endpoint. Never expose it in browser code or prefix it with `NEXT_PUBLIC_`.

### Staff onboarding
Admins can invite Field Agents, Professionals and other Admins from the Admin dashboard. Clients remain the only role that can self-register.
