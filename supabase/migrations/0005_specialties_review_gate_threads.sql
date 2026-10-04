-- 0005: professional specialties, admin review gate, private message threads
--
-- Run AFTER 0001-0004. Safe to run once; it is wrapped in a transaction, so if
-- anything fails nothing is applied and you can fix and re-run.
--
-- What this adds
--   1. Professionals have a specialty (lawyer, surveyor, architect, ...), and a
--      case can have several professionals (one row per person in
--      case_professionals) instead of a single "assigned_professional_id".
--   2. Professionals can add milestones on cases they are assigned to.
--   3. Messages become private threads: client <-> admin, and each field
--      agent / professional <-> admin. A professional can never read or write
--      the client's thread, and vice versa, so contact details cannot be
--      passed around the business.
--   4. Reports and documents go through an admin review gate
--      (pending / approved / rejected). Nothing is visible to another party
--      until an admin approves it AND chooses who it is shared with (client,
--      the rest of the case team, or both). This is enforced in the database
--      and on the file storage buckets, not just in the UI.
--
-- It also closes four permission gaps found in 0001-0004 while reviewing the
-- policies for this change:
--   a. Any signed-in user could UPDATE their own users row, including `role`,
--      i.e. a client could make themselves an admin. Now blocked by a trigger.
--   b. cases.internal_notes ("admin only") was readable by the client and the
--      field team, because RLS works on rows, not columns. Notes now live in
--      their own admin-only table.
--   c. A client creating a case could set its status / assigned agent. Now
--      limited to a plain "intake" request.
--   d. Any agent/professional could attach reports, media or documents to ANY
--      case or milestone. Now limited to the case they are assigned to.

begin;

-- ============================================================
-- 0. ENUMS
-- ============================================================
create type professional_specialty as enum (
  'lawyer',
  'surveyor',
  'architect',
  'structural_engineer',
  'quantity_surveyor',
  'estate_valuer',
  'town_planner',
  'agronomist',
  'other'
);

create type review_state as enum ('pending', 'approved', 'rejected');

-- ============================================================
-- 1. USERS: specialty + protection of privileged columns
-- ============================================================
alter table public.users add column specialty professional_specialty;
alter table public.users
  add constraint users_specialty_only_for_professionals
  check (specialty is null or role = 'professional');

-- Replaces the 0003 version so invited professionals get their specialty from
-- the invite metadata. Everything else is unchanged.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role := coalesce(nullif(new.raw_user_meta_data->>'role', '')::user_role, 'client');
begin
  insert into public.users (id, full_name, email, whatsapp_number, role, specialty, region, country)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'whatsapp_number',
    v_role,
    case when v_role = 'professional'
      then nullif(new.raw_user_meta_data->>'specialty', '')::professional_specialty
    end,
    new.raw_user_meta_data->>'region',
    new.raw_user_meta_data->>'country'
  );
  return new;
end;
$$;

-- Gap (a): users_update_own_or_admin lets people edit their own row, which
-- included `role`. Admins, the service role and the SQL editor (no JWT) may
-- still change these; everyone else may not.
create or replace function public.protect_user_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and public.current_user_role() is distinct from 'admin' then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.specialty is distinct from old.specialty then
      raise exception 'Only an admin can change role, active status or specialty.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger users_protect_privileged_columns
  before update on public.users
  for each row execute function public.protect_user_privileged_columns();

-- ============================================================
-- 2. HELPER FUNCTIONS (security definer so policies don't recurse)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false);
$$;

-- Display label shown to other parties INSTEAD of a name, e.g. "Lawyer",
-- "Field agent". Names are never exposed to clients.
create or replace function public.author_label(p_user uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case u.role
    when 'admin' then 'iConfam team'
    when 'agent' then 'Field agent'
    when 'professional' then coalesce(initcap(replace(u.specialty::text, '_', ' ')), 'Professional')
    else 'Client'
  end
  from public.users u where u.id = p_user;
$$;

create or replace function public.try_uuid(p_text text)
returns uuid
language plpgsql immutable
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- ============================================================
-- 3. CASE PROFESSIONALS (replaces cases.assigned_professional_id)
-- ============================================================
create table public.case_professionals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  professional_id uuid not null references public.users(id),
  assigned_at timestamptz not null default now(),
  unique (case_id, professional_id)
);
create index case_professionals_professional_idx on public.case_professionals (professional_id);

insert into public.case_professionals (case_id, professional_id)
select id, assigned_professional_id
from public.cases
where assigned_professional_id is not null
on conflict do nothing;

-- Everything that referenced cases.assigned_professional_id is rebuilt below,
-- so drop it all first (this is also what lets us drop the column).
drop policy if exists "cases_select" on public.cases;
drop policy if exists "cases_insert_admin_or_client" on public.cases;
drop policy if exists "milestones_select" on public.milestones;
drop policy if exists "milestones_write_admin_only" on public.milestones;
drop policy if exists "reports_select" on public.reports;
drop policy if exists "reports_insert_agent_or_admin" on public.reports;
drop policy if exists "reports_update_admin_only" on public.reports;
drop policy if exists "media_select" on public.media;
drop policy if exists "media_insert_agent_or_admin" on public.media;
drop policy if exists "documents_select" on public.documents;
drop policy if exists "documents_write_professional_or_admin" on public.documents;
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_insert" on public.messages;
drop policy if exists "media_bucket_scoped_read" on storage.objects;
drop policy if exists "media_bucket_scoped_write" on storage.objects;
drop policy if exists "documents_bucket_scoped_read" on storage.objects;
drop policy if exists "documents_bucket_scoped_write" on storage.objects;

alter table public.cases drop column assigned_professional_id;

-- Gap (b): internal notes move to an admin-only table.
create table public.case_internal_notes (
  case_id uuid primary key references public.cases(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.case_internal_notes (case_id, notes)
select id, internal_notes from public.cases
where internal_notes is not null and btrim(internal_notes) <> '';
alter table public.cases drop column internal_notes;

-- ============================================================
-- 4. MORE HELPERS (need case_professionals to exist)
-- ============================================================
create or replace function public.is_case_client(p_case uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.cases c where c.id = p_case and c.client_id = auth.uid());
$$;

create or replace function public.is_case_professional(p_case uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.case_professionals cp
    where cp.case_id = p_case and cp.professional_id = auth.uid()
  );
$$;

-- Field agent or professional assigned to the case.
create or replace function public.is_case_staff(p_case uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.cases c where c.id = p_case and c.assigned_agent_id = auth.uid())
      or public.is_case_professional(p_case);
$$;

create or replace function public.is_case_member(p_case uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin() or public.is_case_client(p_case) or public.is_case_staff(p_case);
$$;

-- Is p_user the client, or assigned agent/professional, of p_case?
create or replace function public.is_case_participant(p_case uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.cases c
                 where c.id = p_case and (c.client_id = p_user or c.assigned_agent_id = p_user))
      or exists (select 1 from public.case_professionals cp
                 where cp.case_id = p_case and cp.professional_id = p_user);
$$;

create or replace function public.milestone_case_id(p_milestone uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select case_id from public.milestones where id = p_milestone;
$$;

create or replace function public.is_report_author(p_report uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.reports where id = p_report and submitted_by = auth.uid());
$$;

-- ============================================================
-- 5. MILESTONES: professionals can add them
-- ============================================================
alter table public.milestones
  add column created_by uuid references public.users(id),
  add column owner_label text;

create or replace function public.milestones_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  new.owner_label := coalesce(public.author_label(new.created_by), 'iConfam team');
  return new;
end;
$$;
create trigger milestones_before_insert
  before insert on public.milestones
  for each row execute function public.milestones_before_insert();

-- Non-admins may change a milestone's status only (and rename ones they
-- created); the RLS check below limits which status values they can set.
create or replace function public.milestones_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.case_id is distinct from old.case_id
       or new.sequence_order is distinct from old.sequence_order
       or new.due_date is distinct from old.due_date
       or new.created_by is distinct from old.created_by
       or new.owner_label is distinct from old.owner_label then
      raise exception 'Only an admin can change those milestone fields.' using errcode = '42501';
    end if;
    if new.name is distinct from old.name and old.created_by is distinct from auth.uid() then
      raise exception 'You can only rename milestones you added.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger milestones_before_update
  before update on public.milestones
  for each row execute function public.milestones_before_update();

create policy "milestones_select" on public.milestones
  for select using (public.is_case_member(case_id));

create policy "milestones_insert" on public.milestones
  for insert with check (
    public.is_admin()
    or (public.current_user_role() = 'professional' and public.is_case_professional(case_id))
  );

create policy "milestones_update" on public.milestones
  for update
  using (public.is_admin() or public.is_case_staff(case_id))
  with check (
    public.is_admin()
    or (public.is_case_staff(case_id) and status in ('pending', 'in_progress'))
  );

create policy "milestones_delete_admin_only" on public.milestones
  for delete using (public.is_admin());

-- ============================================================
-- 6. CASES
-- ============================================================
create policy "cases_select" on public.cases
  for select using (
    client_id = auth.uid()
    or assigned_agent_id = auth.uid()
    or public.is_case_professional(id)
    or public.is_admin()
  );

-- Gap (c): a client can only open a plain intake request.
create policy "cases_insert_admin_or_client" on public.cases
  for insert with check (
    public.is_admin()
    or (client_id = auth.uid() and status = 'intake' and assigned_agent_id is null)
  );

-- cases.updated_at was never refreshed; keep it current so lists sort by
-- real activity.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger cases_touch_updated_at
  before update on public.cases
  for each row execute function public.touch_updated_at();

create or replace function public.bump_case(p_case uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.cases set updated_at = now() where id = p_case;
$$;

create or replace function public.milestones_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform public.bump_case(new.case_id);
  end if;
  return null;
end;
$$;
create trigger milestones_after_change
  after insert or update on public.milestones
  for each row execute function public.milestones_after_change();

-- case_professionals / case_internal_notes
alter table public.case_professionals enable row level security;
create policy "case_professionals_select" on public.case_professionals
  for select using (public.is_admin() or professional_id = auth.uid());
create policy "case_professionals_admin_write" on public.case_professionals
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.case_internal_notes enable row level security;
create policy "case_internal_notes_admin_only" on public.case_internal_notes
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 7. REPORTS: admin review gate
-- ============================================================
alter table public.reports
  add column review_status review_state not null default 'pending',
  add column review_note text,
  add column reviewed_by uuid references public.users(id),
  add column reviewed_at timestamptz,
  add column share_with_client boolean not null default false,
  add column share_with_team boolean not null default false,
  add column author_label text;

-- Keep decisions admins already made under the old on/off switch.
update public.reports
set review_status = 'approved', share_with_client = true, reviewed_at = now()
where client_visible;

update public.reports r
set author_label = public.author_label(r.submitted_by);

alter table public.reports drop column client_visible;

create or replace function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.author_label := public.author_label(new.submitted_by);
  -- Whoever submits it, a report starts life pending and unshared unless an
  -- admin is the one inserting it.
  if auth.uid() is not null and not public.is_admin() then
    new.review_status := 'pending';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.share_with_client := false;
    new.share_with_team := false;
  end if;
  return new;
end;
$$;
create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

create or replace function public.reports_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Reviewers approve or reject; nobody (admin included) rewrites what a field
  -- person actually reported.
  if auth.uid() is not null and (
       new.milestone_id is distinct from old.milestone_id
    or new.submitted_by is distinct from old.submitted_by
    or new.findings_summary is distinct from old.findings_summary
    or new.status_flag is distinct from old.status_flag
    or new.geo_lat is distinct from old.geo_lat
    or new.geo_lng is distinct from old.geo_lng
    or new.visit_time is distinct from old.visit_time
    or new.author_label is distinct from old.author_label
  ) then
    raise exception 'Report content cannot be edited after submission.' using errcode = '42501';
  end if;

  if new.review_status is distinct from old.review_status then
    if new.review_status = 'rejected' and btrim(coalesce(new.review_note, '')) = '' then
      raise exception 'A rejection needs a note explaining why.' using errcode = '23514';
    end if;
    if new.review_status = 'pending' then
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;

  if new.review_status <> 'approved' then
    new.share_with_client := false;
    new.share_with_team := false;
  end if;
  return new;
end;
$$;
create trigger reports_before_update
  before update on public.reports
  for each row execute function public.reports_before_update();

create or replace function public.reports_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.review_status is distinct from old.review_status then
    perform public.bump_case(public.milestone_case_id(new.milestone_id));
  end if;
  return null;
end;
$$;
create trigger reports_after_change
  after insert or update on public.reports
  for each row execute function public.reports_after_change();

create policy "reports_select" on public.reports
  for select using (
    submitted_by = auth.uid()
    or public.is_admin()
    or (
      review_status = 'approved'
      and (
        (share_with_client and public.is_case_client(public.milestone_case_id(milestone_id)))
        or (share_with_team and public.is_case_staff(public.milestone_case_id(milestone_id)))
      )
    )
  );

-- Gap (d): only staff assigned to the milestone's case (or an admin) can file.
create policy "reports_insert" on public.reports
  for insert with check (
    submitted_by = auth.uid()
    and (
      public.is_admin()
      or (
        public.current_user_role() in ('agent', 'professional')
        and public.is_case_staff(public.milestone_case_id(milestone_id))
      )
    )
  );

create policy "reports_update_admin_only" on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 8. MEDIA: follows its report
-- ============================================================
create or replace function public.can_view_report(p_report uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    join public.milestones m on m.id = r.milestone_id
    where r.id = p_report
      and (
        public.is_admin()
        or r.submitted_by = auth.uid()
        or (
          r.review_status = 'approved'
          and (
            (r.share_with_client and public.is_case_client(m.case_id))
            or (r.share_with_team and public.is_case_staff(m.case_id))
          )
        )
      )
  );
$$;

create policy "media_select" on public.media
  for select using (public.can_view_report(report_id));

create policy "media_insert" on public.media
  for insert with check (public.is_admin() or public.is_report_author(report_id));

-- ============================================================
-- 9. DOCUMENTS: admin review gate
-- ============================================================
alter table public.documents
  add column review_status review_state not null default 'pending',
  add column review_note text,
  add column reviewed_by uuid references public.users(id),
  add column reviewed_at timestamptz,
  add column share_with_client boolean not null default false,
  add column share_with_team boolean not null default false,
  add column author_label text;
-- Existing documents were never reviewed, so they start as pending: an admin
-- decides whether they are shared.

update public.documents d
set author_label = public.author_label(d.uploaded_by);

create or replace function public.documents_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.author_label := public.author_label(new.uploaded_by);
  if auth.uid() is not null and not public.is_admin() then
    new.review_status := 'pending';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.share_with_client := false;
    new.share_with_team := false;
  end if;
  return new;
end;
$$;
create trigger documents_before_insert
  before insert on public.documents
  for each row execute function public.documents_before_insert();

create or replace function public.documents_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and (
       new.case_id is distinct from old.case_id
    or new.doc_type is distinct from old.doc_type
    or new.storage_path is distinct from old.storage_path
    or new.uploaded_by is distinct from old.uploaded_by
    or new.author_label is distinct from old.author_label
  ) then
    raise exception 'Document details cannot be edited after upload.' using errcode = '42501';
  end if;

  if new.review_status is distinct from old.review_status then
    if new.review_status = 'rejected' and btrim(coalesce(new.review_note, '')) = '' then
      raise exception 'A rejection needs a note explaining why.' using errcode = '23514';
    end if;
    if new.review_status = 'pending' then
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;

  if new.review_status <> 'approved' then
    new.share_with_client := false;
    new.share_with_team := false;
  end if;
  return new;
end;
$$;
create trigger documents_before_update
  before update on public.documents
  for each row execute function public.documents_before_update();

create policy "documents_select" on public.documents
  for select using (
    public.is_admin()
    or uploaded_by = auth.uid()
    or (
      review_status = 'approved'
      and (
        (share_with_client and public.is_case_client(case_id))
        or (share_with_team and public.is_case_staff(case_id))
      )
    )
  );

create policy "documents_insert" on public.documents
  for insert with check (
    uploaded_by = auth.uid()
    and (
      public.is_admin()
      or (public.current_user_role() = 'professional' and public.is_case_professional(case_id))
    )
  );

create policy "documents_update_admin_only" on public.documents
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 10. STORAGE: files obey the same review gate as the rows that describe them
-- ============================================================
-- Before this, a client could read every file under their case's folder (and
-- list the folder), so an unreviewed upload was one `list()` call away.
create or replace function public.can_read_document_file(p_path text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.documents d
    where d.storage_path = p_path
      and (
        public.is_admin()
        or d.uploaded_by = auth.uid()
        or (
          d.review_status = 'approved'
          and (
            (d.share_with_client and public.is_case_client(d.case_id))
            or (d.share_with_team and public.is_case_staff(d.case_id))
          )
        )
      )
  );
$$;

create or replace function public.can_read_media_file(p_path text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.media m
    where m.storage_path = p_path and public.can_view_report(m.report_id)
  );
$$;

create policy "media_bucket_gated_read" on storage.objects
  for select using (
    bucket_id = 'iconfam-media' and public.can_read_media_file(name)
  );

create policy "media_bucket_scoped_write" on storage.objects
  for insert with check (
    bucket_id = 'iconfam-media'
    and (
      public.is_admin()
      or public.is_case_staff(public.try_uuid((storage.foldername(name))[1]))
    )
  );

create policy "documents_bucket_gated_read" on storage.objects
  for select using (
    bucket_id = 'iconfam-documents' and public.can_read_document_file(name)
  );

create policy "documents_bucket_scoped_write" on storage.objects
  for insert with check (
    bucket_id = 'iconfam-documents'
    and (
      public.is_admin()
      or (
        public.current_user_role() = 'professional'
        and public.is_case_professional(public.try_uuid((storage.foldername(name))[1]))
      )
    )
  );

-- ============================================================
-- 11. MESSAGES: private threads
-- ============================================================
-- thread_user_id = the non-admin person whose conversation with the admin
-- team this message belongs to. For the client's thread that's the client;
-- for a professional's thread it's that professional. Admins can read and post
-- in every thread; everyone else sees only their own.
alter table public.messages
  add column thread_user_id uuid references public.users(id);

-- Every message that exists today was a client <-> admin conversation.
update public.messages m
set thread_user_id = c.client_id
from public.cases c
where c.id = m.case_id;

alter table public.messages alter column thread_user_id set not null;
create index messages_case_thread_idx on public.messages (case_id, thread_user_id, sent_at);

create policy "messages_select" on public.messages
  for select using (
    public.is_admin()
    or (thread_user_id = auth.uid() and public.is_case_member(case_id))
  );

create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      -- admin replying into one participant's thread
      (public.is_admin() and public.is_case_participant(case_id, thread_user_id))
      -- anyone else writing in their own thread (i.e. to the admin team)
      or (
        not public.is_admin()
        and thread_user_id = auth.uid()
        and public.is_case_participant(case_id, auth.uid())
      )
    )
  );

commit;
