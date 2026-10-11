-- 0017: An admin can assign each milestone to one person on the case team
-- (the field agent or one of the professionals).
--  * milestones.assigned_to / assigned_label. Only an admin can set or change it, and
--    only to someone who is on that case.
--  * A milestone with an assignee can be worked (status, check-in, report) only by that
--    person. A milestone with no assignee behaves as before: anyone on the case team.
--  * If someone leaves the case (agent changed, professional removed), their milestones
--    go back to unassigned.
--  * The assignee gets an email.
-- Run AFTER 0016.

alter table public.milestones
  add column if not exists assigned_to uuid references public.users(id) on delete set null,
  add column if not exists assigned_label text;
create index if not exists milestones_assigned_to_idx on public.milestones (assigned_to) where assigned_to is not null;

-- True when the person is the case's field agent or one of its professionals.
create or replace function public.is_on_case_team(p_case uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.cases c where c.id = p_case and c.assigned_agent_id = p_user)
      or exists (select 1 from public.case_professionals cp where cp.case_id = p_case and cp.professional_id = p_user);
$$;

-- Admin-only assignment, validated against the case team.
create or replace function public.milestones_assignment_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is not null then
      if auth.uid() is not null and not public.is_admin() then
        raise exception 'Only an admin can assign a milestone.' using errcode = '42501';
      end if;
      if not public.is_on_case_team(new.case_id, new.assigned_to) then
        raise exception 'assignee_not_on_case' using errcode = '23514';
      end if;
      new.assigned_label := public.author_label(new.assigned_to);
    else
      if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_admin() then
        raise exception 'Only an admin can change who a milestone is assigned to.' using errcode = '42501';
      end if;
      new.assigned_label := null;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists milestones_assignment_guard_trg on public.milestones;
create trigger milestones_assignment_guard_trg
  before insert or update on public.milestones
  for each row execute function public.milestones_assignment_guard();

-- Only the assignee (or anyone on the team, if unassigned) can change the status.
drop policy if exists "milestones_update" on public.milestones;
create policy "milestones_update" on public.milestones
  for update
  using (
    public.is_admin()
    or (public.is_case_staff(case_id) and (assigned_to is null or assigned_to = auth.uid()))
  )
  with check (
    public.is_admin()
    or (public.is_case_staff(case_id) and (assigned_to is null or assigned_to = auth.uid()))
  );

-- Check-ins and reports for an assigned milestone belong to its assignee.
create or replace function public.guard_milestone_assignee()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_to uuid;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  select assigned_to into v_to from public.milestones where id = new.milestone_id;
  if v_to is not null and v_to <> auth.uid() then
    raise exception 'milestone_assigned_to_someone_else' using errcode = '42501',
      hint = 'This milestone is assigned to another team member.';
  end if;
  return new;
end;
$$;
drop trigger if exists reports_guard_assignee on public.reports;
create trigger reports_guard_assignee before insert on public.reports
  for each row execute function public.guard_milestone_assignee();
drop trigger if exists site_visits_guard_assignee on public.site_visits;
create trigger site_visits_guard_assignee before insert on public.site_visits
  for each row execute function public.guard_milestone_assignee();

-- When someone leaves the case, their milestones are unassigned.
create or replace function public.cases_release_milestones()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.assigned_agent_id is not null and new.assigned_agent_id is distinct from old.assigned_agent_id then
    update public.milestones set assigned_to = null where case_id = new.id and assigned_to = old.assigned_agent_id;
  end if;
  return new;
end;
$$;
drop trigger if exists cases_release_milestones_trg on public.cases;
create trigger cases_release_milestones_trg after update on public.cases
  for each row execute function public.cases_release_milestones();

create or replace function public.case_professionals_release_milestones()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.milestones set assigned_to = null
   where case_id = old.case_id and assigned_to = old.professional_id;
  return old;
end;
$$;
drop trigger if exists case_professionals_release_milestones_trg on public.case_professionals;
create trigger case_professionals_release_milestones_trg after delete on public.case_professionals
  for each row execute function public.case_professionals_release_milestones();

-- Tell the assignee.
create or replace function public.milestones_after_assign_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_user public.users%rowtype;
begin
  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    select * into v_user from public.users where id = new.assigned_to;
    perform public.enqueue_notification(
      'milestone_assigned', v_user.id, null, v_user.full_name,
      (public.case_brief(new.case_id) - 'client_id') || jsonb_build_object('step', new.name, 'milestone_id', new.id),
      'ms-assign:' || new.id || ':' || new.assigned_to, 60);
  end if;
  return new;
end;
$$;
drop trigger if exists milestones_after_assign_notify_trg on public.milestones;
create trigger milestones_after_assign_notify_trg after insert or update on public.milestones
  for each row execute function public.milestones_after_assign_notify();
