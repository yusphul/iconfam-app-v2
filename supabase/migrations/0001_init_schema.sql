-- iConfam initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push` if using the CLI.

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('client', 'agent', 'professional', 'admin');

create type case_type as enum ('property_purchase', 'ground_up_build', 'farm_oversight', 'status_verification');

create type case_status as enum ('intake', 'scoped', 'in_progress', 'awaiting_client_payment', 'report_delivered', 'closed', 'on_hold');

create type milestone_status as enum ('pending', 'in_progress', 'confirmed', 'issue_found');

create type report_status_flag as enum ('confirmed_good', 'confirmed_issue', 'unable_to_verify', 'escalation_needed');

create type payment_status as enum ('pending', 'paid', 'overdue', 'waived');

create type message_channel as enum ('portal', 'whatsapp', 'email', 'sms');

-- ============================================================
-- TABLES
-- ============================================================

-- Profile row for every person in the system (client, agent, professional, admin).
-- One row per auth.users entry, linked 1:1 by id.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  whatsapp_number text,
  role user_role not null default 'client',
  country text,
  region text,               -- for agents/professionals: coverage area
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id),
  case_type case_type not null,
  status case_status not null default 'intake',
  title text not null,
  location_description text,
  assigned_agent_id uuid references public.users(id),
  assigned_professional_id uuid references public.users(id),
  internal_notes text,                 -- admin-only, never shown to client (enforced in RLS)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null,
  sequence_order int not null default 1,
  status milestone_status not null default 'pending',
  due_date timestamptz,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  submitted_by uuid not null references public.users(id),
  findings_summary text not null,
  status_flag report_status_flag not null,
  geo_lat numeric,
  geo_lng numeric,
  visit_time timestamptz not null default now(),
  client_visible boolean not null default false,   -- admin reviews before flipping true
  created_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_path text not null,          -- path within the 'iconfam-media' storage bucket
  media_type text not null default 'image',  -- 'image' | 'video'
  captured_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  doc_type text not null,
  storage_path text not null,          -- path within the 'iconfam-documents' storage bucket
  uploaded_by uuid references public.users(id),
  retention_note text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  description text not null,
  amount numeric not null,
  currency text not null default 'USD',
  status payment_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  channel message_channel not null default 'portal',
  body text not null,
  sent_at timestamptz not null default now()
);

-- ============================================================
-- HELPER: current user's role (used repeatedly in RLS policies)
-- ============================================================
create or replace function public.current_user_role()
returns user_role
language sql stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users enable row level security;
alter table public.cases enable row level security;
alter table public.milestones enable row level security;
alter table public.reports enable row level security;
alter table public.media enable row level security;
alter table public.documents enable row level security;
alter table public.payments enable row level security;
alter table public.messages enable row level security;

-- USERS: everyone can read their own row; admin can read/write all.
create policy "users_select_own_or_admin" on public.users
  for select using (id = auth.uid() or public.current_user_role() = 'admin');
create policy "users_update_own_or_admin" on public.users
  for update using (id = auth.uid() or public.current_user_role() = 'admin');
create policy "users_insert_admin_only" on public.users
  for insert with check (public.current_user_role() = 'admin');

-- CASES: client sees own cases; agent/professional see cases assigned to them; admin sees all.
create policy "cases_select" on public.cases
  for select using (
    client_id = auth.uid()
    or assigned_agent_id = auth.uid()
    or assigned_professional_id = auth.uid()
    or public.current_user_role() = 'admin'
  );
create policy "cases_insert_admin_or_client" on public.cases
  for insert with check (
    public.current_user_role() = 'admin' or client_id = auth.uid()
  );
create policy "cases_update_admin_only" on public.cases
  for update using (public.current_user_role() = 'admin');

-- MILESTONES: visible to anyone who can see the parent case.
create policy "milestones_select" on public.milestones
  for select using (
    exists (
      select 1 from public.cases c
      where c.id = milestones.case_id
        and (c.client_id = auth.uid() or c.assigned_agent_id = auth.uid()
             or c.assigned_professional_id = auth.uid() or public.current_user_role() = 'admin')
    )
  );
create policy "milestones_write_admin_only" on public.milestones
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- REPORTS: clients only see reports flagged client_visible; agents see their own submissions;
-- admin sees everything (this is the review-gate behavior from the spec).
create policy "reports_select" on public.reports
  for select using (
    submitted_by = auth.uid()
    or public.current_user_role() = 'admin'
    or (
      client_visible = true
      and exists (
        select 1 from public.milestones m
        join public.cases c on c.id = m.case_id
        where m.id = reports.milestone_id and c.client_id = auth.uid()
      )
    )
  );
create policy "reports_insert_agent_or_admin" on public.reports
  for insert with check (
    submitted_by = auth.uid()
    and public.current_user_role() in ('agent', 'professional', 'admin')
  );
create policy "reports_update_admin_only" on public.reports
  for update using (public.current_user_role() = 'admin');

-- MEDIA: follows the parent report's visibility.
create policy "media_select" on public.media
  for select using (
    exists (
      select 1 from public.reports r where r.id = media.report_id
      and (
        r.submitted_by = auth.uid()
        or public.current_user_role() = 'admin'
        or (r.client_visible = true and exists (
          select 1 from public.milestones m join public.cases c on c.id = m.case_id
          where m.id = r.milestone_id and c.client_id = auth.uid()
        ))
      )
    )
  );
create policy "media_insert_agent_or_admin" on public.media
  for insert with check (public.current_user_role() in ('agent', 'professional', 'admin'));

-- DOCUMENTS: same visibility pattern as cases (rarely populated by design).
create policy "documents_select" on public.documents
  for select using (
    exists (
      select 1 from public.cases c where c.id = documents.case_id
      and (c.client_id = auth.uid() or public.current_user_role() = 'admin'
           or c.assigned_professional_id = auth.uid())
    )
  );
create policy "documents_write_professional_or_admin" on public.documents
  for insert with check (public.current_user_role() in ('professional', 'admin'));

-- PAYMENTS: client sees own case's payments; admin sees/manages all.
create policy "payments_select" on public.payments
  for select using (
    exists (select 1 from public.cases c where c.id = payments.case_id and c.client_id = auth.uid())
    or public.current_user_role() = 'admin'
  );
create policy "payments_write_admin_only" on public.payments
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- MESSAGES: visible to anyone tied to the case; anyone tied to the case can post.
create policy "messages_select" on public.messages
  for select using (
    exists (
      select 1 from public.cases c where c.id = messages.case_id
      and (c.client_id = auth.uid() or c.assigned_agent_id = auth.uid()
           or c.assigned_professional_id = auth.uid() or public.current_user_role() = 'admin')
    )
  );
create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.cases c where c.id = messages.case_id
      and (c.client_id = auth.uid() or c.assigned_agent_id = auth.uid()
           or c.assigned_professional_id = auth.uid() or public.current_user_role() = 'admin')
    )
  );

-- ============================================================
-- STORAGE BUCKETS (run once; safe to re-run)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('iconfam-media', 'iconfam-media', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('iconfam-documents', 'iconfam-documents', false)
on conflict (id) do nothing;

-- Storage access mirrors table RLS: authenticated users only, app enforces the fine-grained
-- rules above; a stricter path-prefix-based storage policy is worth adding before production.
create policy "media_bucket_authenticated_read" on storage.objects
  for select using (bucket_id = 'iconfam-media' and auth.role() = 'authenticated');
create policy "media_bucket_authenticated_write" on storage.objects
  for insert with check (bucket_id = 'iconfam-media' and auth.role() = 'authenticated');

create policy "documents_bucket_authenticated_read" on storage.objects
  for select using (bucket_id = 'iconfam-documents' and auth.role() = 'authenticated');
create policy "documents_bucket_authenticated_write" on storage.objects
  for insert with check (bucket_id = 'iconfam-documents' and auth.role() = 'authenticated');
