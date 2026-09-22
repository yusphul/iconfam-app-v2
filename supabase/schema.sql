-- iConfam production schema. Run in Supabase SQL Editor on a new project.
create extension if not exists pgcrypto;
create type public.user_role as enum ('client','field_agent','professional','admin');
create type public.case_status as enum ('requested','quoted','paid','assigned','in_progress','under_review','completed','cancelled','refunded');
create type public.review_status as enum ('pending','approved','rejected');

create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, full_name text, role public.user_role not null default 'client', phone text, created_at timestamptz not null default now());
create table public.cases(id uuid primary key default gen_random_uuid(), case_number text unique not null default ('IC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))), client_id uuid not null references public.profiles(id), title text not null, verification_type text not null, location text not null, outside_party text, description text not null, status public.case_status not null default 'requested', flat_fee numeric(12,2), work_started_at timestamptz, created_at timestamptz not null default now());
create table public.assignments(id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade, verifier_id uuid not null references public.profiles(id), assigned_by uuid not null references public.profiles(id), outside_party text, status text not null default 'assigned', created_at timestamptz not null default now());
create table public.findings(id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade, assignment_id uuid not null references public.assignments(id), submitted_by uuid not null references public.profiles(id), description text not null, latitude numeric, longitude numeric, review_status public.review_status not null default 'pending', reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now());
create table public.evidence(id uuid primary key default gen_random_uuid(), finding_id uuid not null references public.findings(id) on delete cascade, storage_path text not null, media_type text not null, captured_at timestamptz, created_at timestamptz not null default now());
create table public.reports(id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade, status public.review_status not null default 'pending', summary text not null, approved_by uuid references public.profiles(id), approved_at timestamptz, created_at timestamptz not null default now());
create table public.payments(id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade, amount numeric(12,2) not null, status text not null check(status in ('pending','paid','refunded')), reference text, created_at timestamptz not null default now());
create table public.messages(id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade, sender_id uuid not null references public.profiles(id), body text not null, created_at timestamptz not null default now());

-- Every self-signup becomes a client. Staff roles cannot self-enroll.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','Client'),'client'); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;
create or replace function public.is_assigned(caseid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from assignments where case_id=caseid and verifier_id=auth.uid()) $$;

alter table profiles enable row level security; alter table cases enable row level security; alter table assignments enable row level security; alter table findings enable row level security; alter table evidence enable row level security; alter table reports enable row level security; alter table payments enable row level security; alter table messages enable row level security;

create policy "profile self or admin read" on profiles for select using(id=auth.uid() or is_admin());
create policy "client update own profile" on profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "clients see own cases; staff assigned; admin all" on cases for select using(client_id=auth.uid() or is_assigned(id) or is_admin());
create policy "clients create own cases" on cases for insert with check(client_id=auth.uid() and exists(select 1 from profiles where id=auth.uid() and role='client'));
create policy "admins update cases" on cases for update using(is_admin());
create policy "assigned or admin read assignments" on assignments for select using(verifier_id=auth.uid() or is_admin());
create policy "admin assigns" on assignments for insert with check(is_admin());
create policy "assigned submit findings" on findings for insert with check(submitted_by=auth.uid() and is_assigned(case_id));
create policy "submitter or admin read raw findings" on findings for select using(submitted_by=auth.uid() or is_admin());
create policy "admin reviews findings" on findings for update using(is_admin());
create policy "client sees approved reports" on reports for select using((status='approved' and exists(select 1 from cases c where c.id=case_id and c.client_id=auth.uid())) or is_admin());
create policy "admin manages reports" on reports for all using(is_admin()) with check(is_admin());
create policy "client own payment records or admin" on payments for select using(exists(select 1 from cases c where c.id=case_id and c.client_id=auth.uid()) or is_admin());
create policy "admin manages payments" on payments for all using(is_admin()) with check(is_admin());
create policy "case participants messages" on messages for select using(exists(select 1 from cases c where c.id=case_id and (c.client_id=auth.uid() or is_assigned(c.id))) or is_admin());
create policy "case participants send messages" on messages for insert with check(sender_id=auth.uid() and (exists(select 1 from cases c where c.id=case_id and (c.client_id=auth.uid() or is_assigned(c.id))) or is_admin()));
create policy "assigned evidence read" on evidence for select using(exists(select 1 from findings f where f.id=finding_id and (f.submitted_by=auth.uid() or is_admin())));
create policy "assigned evidence insert" on evidence for insert with check(exists(select 1 from findings f where f.id=finding_id and f.submitted_by=auth.uid()));

-- Assignment integrity: warn/block repeat pairing with same outside party.
create or replace function public.prevent_repeat_pairing() returns trigger language plpgsql as $$ begin if new.outside_party is not null and exists(select 1 from assignments a where a.verifier_id=new.verifier_id and lower(coalesce(a.outside_party,''))=lower(new.outside_party) and a.case_id<>new.case_id) then raise exception 'Independence rule: this verifier has previously been paired with the same outside party.'; end if; return new; end $$;
create trigger check_repeat_pairing before insert on assignments for each row execute function public.prevent_repeat_pairing();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evidence','evidence',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']) on conflict do nothing;

-- Private Storage RLS for evidence objects. Verifiers may upload only; admins may inspect/manage.
create policy "assigned staff upload evidence objects" on storage.objects for insert to authenticated with check(bucket_id='evidence' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('field_agent','professional')));
create policy "admins read evidence objects" on storage.objects for select to authenticated using(bucket_id='evidence' and public.is_admin());
create policy "submitter read own evidence objects" on storage.objects for select to authenticated using(bucket_id='evidence' and exists(select 1 from public.evidence e join public.findings f on f.id=e.finding_id where e.storage_path=name and f.submitted_by=auth.uid()));
