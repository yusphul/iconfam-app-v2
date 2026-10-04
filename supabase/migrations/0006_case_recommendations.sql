-- 0006: iConfam's recommendation / summary for each case
--
-- Run AFTER 0005. Wrapped in a transaction, so if anything fails nothing is
-- applied and you can fix and re-run.
--
-- Each case can carry one recommendation written by the admin team: a verdict
-- (proceed / proceed with caution / do not proceed / inconclusive), a plain
-- language summary, and optional next steps. It is a DRAFT until the admin
-- publishes it. Until then the client cannot see it, so half-written or
-- unreviewed advice never reaches them. Professionals and field agents never
-- see it at all: only the admin and the case's own client can read this table.

begin;

create type recommendation_verdict as enum (
  'proceed',
  'proceed_with_caution',
  'do_not_proceed',
  'inconclusive'
);

create table public.case_recommendations (
  case_id      uuid primary key references public.cases(id) on delete cascade,
  verdict      recommendation_verdict not null,
  summary      text not null check (btrim(summary) <> ''),
  next_steps   text,
  published    boolean not null default false,
  published_at timestamptz,
  updated_by   uuid references public.users(id),
  updated_at   timestamptz not null default now()
);

-- Stamp who/when on every save, and keep published_at honest: set when it goes
-- live, cleared when it is pulled back to draft.
create or replace function public.case_recommendations_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.published then
    if tg_op = 'INSERT' or not old.published or old.published_at is null then
      new.published_at := now();
    else
      new.published_at := old.published_at;
    end if;
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;
create trigger case_recommendations_before_write
  before insert or update on public.case_recommendations
  for each row execute function public.case_recommendations_before_write();

-- Publishing counts as case activity (lists sort by cases.updated_at).
create or replace function public.case_recommendations_after_write()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    perform public.bump_case(new.case_id);
  end if;
  return null;
end;
$$;
create trigger case_recommendations_after_write
  after insert or update on public.case_recommendations
  for each row execute function public.case_recommendations_after_write();

alter table public.case_recommendations enable row level security;

create policy "case_recommendations_admin_all" on public.case_recommendations
  for all using (public.is_admin()) with check (public.is_admin());

create policy "case_recommendations_client_published" on public.case_recommendations
  for select using (published and public.is_case_client(case_id));

commit;
