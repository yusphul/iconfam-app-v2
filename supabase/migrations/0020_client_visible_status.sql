-- 0020: The client only sees the status the ADMIN sets.
-- Field agents and professionals may change a case's working status (0016), but that is
-- internal. cases.client_status is what the client portal and the client's status emails use.
--  * It follows `status` when an admin (or the system, auth.uid() null) changes it.
--  * A change made by an agent or professional leaves it alone, so the client sees no change.
--  * Nobody but an admin can write client_status directly (to "publish" the current status).
--  * The "your case is now ..." email to the client now fires from client_status changes.
-- Run AFTER 0019.

alter table public.cases add column if not exists client_status public.case_status;
update public.cases set client_status = status where client_status is null;
alter table public.cases alter column client_status set not null;

create or replace function public.cases_client_status_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text := public.current_user_role();
begin
  if tg_op = 'INSERT' then
    new.client_status := new.status;
    return new;
  end if;
  if auth.uid() is not null and v_role is distinct from 'admin' then
    -- Not an admin: client_status can never be set by hand, and only follows status for a client.
    if new.client_status is distinct from old.client_status then new.client_status := old.client_status; end if;
    if v_role = 'client' and new.status is distinct from old.status then new.client_status := new.status; end if;
    return new;
  end if;
  -- Admin or system: follow status unless client_status was set explicitly in the same update.
  if new.status is distinct from old.status and new.client_status is not distinct from old.client_status then
    new.client_status := new.status;
  end if;
  return new;
end $$;

drop trigger if exists cases_client_status_sync_trg on public.cases;
create trigger cases_client_status_sync_trg
  before insert or update on public.cases
  for each row execute function public.cases_client_status_sync();

create or replace function public.cases_after_update_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_brief jsonb := public.case_brief(new.id);
  v_client public.users%rowtype;
  v_agent public.users%rowtype;
begin
  if new.client_status is distinct from old.client_status and new.client_status in ('in_progress', 'report_delivered', 'on_hold') then
    select * into v_client from public.users where id = new.client_id;
    perform public.enqueue_notification(
      'case_status', v_client.id, null, v_client.full_name,
      v_brief || jsonb_build_object('status', new.client_status));
  end if;
  if new.assigned_agent_id is not null and new.assigned_agent_id is distinct from old.assigned_agent_id then
    select * into v_agent from public.users where id = new.assigned_agent_id;
    perform public.enqueue_notification(
      'assigned_to_case', v_agent.id, null, v_agent.full_name,
      (v_brief - 'client_id') || jsonb_build_object('role', 'agent'));
  end if;
  return new;
end;
$$;
