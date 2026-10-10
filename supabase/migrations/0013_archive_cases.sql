-- 0013: Archive finished cases.
-- An archived case is hidden from the admin dashboard and the default case list but is
-- kept in full: the client can still open it, and its invoices still count in the
-- Payments totals. Only a Closed case can be archived, and re-opening it (moving it
-- out of Closed) un-archives it automatically.

alter table public.cases add column if not exists archived_at timestamptz;
create index if not exists cases_archived_idx on public.cases (archived_at) where archived_at is not null;

create or replace function public.cases_archive_rule()
returns trigger language plpgsql as $$
begin
  if new.archived_at is not null and new.status <> 'closed' then
    if tg_op = 'UPDATE' and old.status = 'closed' and new.status is distinct from old.status then
      new.archived_at := null;           -- re-opened: bring it back
    else
      raise exception 'only_closed_cases_can_be_archived' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cases_archive_rule on public.cases;
create trigger cases_archive_rule before insert or update on public.cases
  for each row execute function public.cases_archive_rule();
