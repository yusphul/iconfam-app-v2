-- 0016: The field agent (and the case professional) can update progress themselves.
--  * Milestones: whoever is assigned to the case can set any milestone to Pending,
--    In Progress, Confirmed or Issue Found. (Before, they could only use the first two.)
--    Confirmed and Issue Found still email the client, as before.
--  * Case status: set_case_status() lets them move their own case between In Progress,
--    On Hold and Report Delivered. Intake, Scoped, Awaiting Payment and Closed stay with
--    the admin, and the deposit gate still applies (no work before payment).
-- Run AFTER 0015.

drop policy if exists "milestones_update" on public.milestones;
create policy "milestones_update" on public.milestones
  for update
  using (public.is_admin() or public.is_case_staff(case_id))
  with check (public.is_admin() or public.is_case_staff(case_id));

create or replace function public.set_case_status(p_case uuid, p_status public.case_status)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_status public.case_status;
begin
  select status into v_status from public.cases where id = p_case;
  if not found then raise exception 'case_not_found'; end if;

  if not public.is_admin() then
    if not public.is_case_staff(p_case) then
      raise exception 'not_assigned' using errcode = '42501';
    end if;
    if p_status not in ('in_progress', 'on_hold', 'report_delivered') then
      raise exception 'status_not_allowed' using errcode = '42501';
    end if;
    -- A paid case is still labelled "Awaiting Payment" until someone moves it, so the field
    -- team may start it once the deposit has cleared.
    if v_status in ('intake', 'scoped', 'closed')
       or (v_status = 'awaiting_client_payment' and not public.deposit_cleared(p_case)) then
      raise exception 'status_locked' using errcode = '42501';
    end if;
  end if;

  update public.cases set status = p_status where id = p_case;
end;
$$;
grant execute on function public.set_case_status(uuid, public.case_status) to authenticated;
