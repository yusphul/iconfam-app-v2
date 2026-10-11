-- 0018: One report per milestone per person, unless the admin rejected it.
-- A field agent or professional who already has a pending or approved report on a
-- milestone cannot send another. A rejected report can be replaced by a new one.
-- Admins are not limited. Run AFTER 0017.

create or replace function public.guard_one_report_per_milestone()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if exists (
    select 1 from public.reports r
     where r.milestone_id = new.milestone_id
       and r.submitted_by = new.submitted_by
       and r.review_status in ('pending', 'approved')
  ) then
    raise exception 'report_already_submitted' using errcode = 'P0001',
      hint = 'You already sent a report for this milestone. You can send another only if the admin rejects it.';
  end if;
  return new;
end;
$$;
drop trigger if exists reports_one_per_milestone on public.reports;
create trigger reports_one_per_milestone before insert on public.reports
  for each row execute function public.guard_one_report_per_milestone();
