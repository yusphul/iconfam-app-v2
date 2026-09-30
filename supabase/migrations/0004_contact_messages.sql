-- Public "Contact us" form submissions on the marketing homepage.
-- Unlike every other table in this schema, rows here are written by
-- anonymous visitors (no auth.uid()) — the public-facing contact form has
-- no sign-in step. Spam filtering (honeypot field + minimum time-on-page)
-- happens in the API route (src/app/api/contact/route.ts) before a row
-- ever reaches this table; RLS below only controls who can read/write once
-- a submission is accepted.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  handled boolean not null default false,   -- admin marks true once followed up
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Anyone can submit a message (this is the whole point of a public contact
-- form) — but only through the app's own API route, which validates and
-- rate-limits the fields below before inserting. Nothing lets the public
-- read, update, or delete rows.
create policy "contact_messages_insert_public" on public.contact_messages
  for insert with check (true);

create policy "contact_messages_select_admin_only" on public.contact_messages
  for select using (public.current_user_role() = 'admin');

create policy "contact_messages_update_admin_only" on public.contact_messages
  for update using (public.current_user_role() = 'admin');
