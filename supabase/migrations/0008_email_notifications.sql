-- 0008: email notifications.
--
-- Database triggers write a row to notification_outbox whenever something
-- happens that a person should hear about. The app (src/lib/email) reads the
-- outbox, renders the email and sends it. Keeping the queue in the database means
-- nothing is lost if the email provider is down: unsent rows are retried.
--
-- Also fixes rescheduling a call so it is recorded as ONE change (needed for
-- sending the right "call moved" email), and adds reminder tracking.
--
-- Run after 0007.

begin;

-- ============================================================
-- 1. OUTBOX
-- ============================================================
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  to_user_id uuid references public.users(id) on delete cascade,
  to_email text,
  to_name text,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text,
  check (to_user_id is not null or to_email is not null)
);
create index notification_outbox_pending_idx on public.notification_outbox (created_at)
  where sent_at is null;
create index notification_outbox_dedupe_idx on public.notification_outbox (dedupe_key, created_at)
  where dedupe_key is not null;

alter table public.notification_outbox enable row level security;
-- Only admins may read it (to see what was sent). Nobody writes except the
-- triggers below and the server's service role.
create policy "notification_outbox_admin_select" on public.notification_outbox
  for select using (public.is_admin());

create or replace function public.enqueue_notification(
  p_kind text, p_user uuid, p_email text, p_name text, p_payload jsonb,
  p_dedupe_key text default null, p_dedupe_minutes int default 0
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_dedupe_key is not null and p_dedupe_minutes > 0 and exists (
       select 1 from public.notification_outbox
       where dedupe_key = p_dedupe_key
         and created_at > now() - make_interval(mins => p_dedupe_minutes)) then
    return;
  end if;
  insert into public.notification_outbox (kind, to_user_id, to_email, to_name, payload, dedupe_key)
  values (p_kind, p_user, p_email, p_name, coalesce(p_payload, '{}'::jsonb), p_dedupe_key);
end;
$$;
revoke all on function public.enqueue_notification(text, uuid, text, text, jsonb, text, int) from public, anon, authenticated;

create or replace function public.notify_admins(
  p_kind text, p_payload jsonb, p_dedupe_key text default null, p_dedupe_minutes int default 0
)
returns void
language plpgsql security definer set search_path = public
as $$
declare a record;
begin
  for a in select id, full_name from public.users where role = 'admin' and active and email is not null loop
    perform public.enqueue_notification(
      p_kind, a.id, null, a.full_name, p_payload,
      case when p_dedupe_key is null then null else p_dedupe_key || ':' || a.id end,
      p_dedupe_minutes);
  end loop;
end;
$$;
revoke all on function public.notify_admins(text, jsonb, text, int) from public, anon, authenticated;

-- The server claims a batch to send. SKIP LOCKED + claimed_at stops two
-- simultaneous requests from sending the same email twice; a claim older than
-- five minutes (a crash mid-send) is retried, up to 5 attempts, for 3 days.
create or replace function public.claim_notifications(p_limit int)
returns setof public.notification_outbox
language sql security definer set search_path = public
as $$
  update public.notification_outbox o
     set claimed_at = now(), attempts = o.attempts + 1
   where o.id in (
     select id from public.notification_outbox
     where sent_at is null
       and attempts < 5
       and created_at > now() - interval '3 days'
       and (claimed_at is null or claimed_at < now() - interval '5 minutes')
     order by created_at
     limit greatest(p_limit, 0)
     for update skip locked)
  returning o.*;
$$;
revoke all on function public.claim_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;

-- Small helpers for building payloads.
create or replace function public.case_brief(p_case uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('case_id', c.id, 'case_title', c.title, 'case_type', c.case_type, 'client_id', c.client_id)
  from public.cases c where c.id = p_case;
$$;
revoke all on function public.case_brief(uuid) from public, anon, authenticated;

-- ============================================================
-- 2. LEADS AND CALLS
-- ============================================================
alter table public.leads add column reminder_sent_at timestamptz;

drop function public.available_slots(int);
create or replace function public.available_slots(p_minutes int, p_exclude uuid default null)
returns setof timestamptz
language sql stable security definer set search_path = public
as $$
  with s as (select * from public.booking_settings limit 1),
  days as (
    select d::date as day
    from s, generate_series(
      ((now() at time zone s.timezone)::date)::timestamp,
      ((now() at time zone s.timezone)::date + s.horizon_days)::timestamp,
      interval '1 day') d
  ),
  cand as (
    select distinct (g.local_ts at time zone s.timezone) as start_at
    from s
    cross join days
    join public.availability_rules r on r.weekday = extract(dow from days.day)::int
    cross join lateral generate_series(
      days.day + r.start_time,
      days.day + r.end_time - make_interval(mins => p_minutes),
      make_interval(mins => s.slot_step_minutes)
    ) as g(local_ts)
  )
  select c.start_at
  from cand c, s
  where p_minutes in (30, 60)
    and c.start_at >= now() + make_interval(hours => s.min_notice_hours)
    and not exists (
      select 1 from public.leads l
      where l.call_at is not null
        and (p_exclude is null or l.id <> p_exclude)
        and tstzrange(l.call_at, l.call_at + make_interval(mins => l.call_minutes))
            && tstzrange(c.start_at, c.start_at + make_interval(mins => p_minutes))
    )
  order by c.start_at;
$$;
grant execute on function public.available_slots(int, uuid) to anon, authenticated;

create or replace function public.book_lead_call(p_token uuid, p_start timestamptz, p_minutes int)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
begin
  perform pg_advisory_xact_lock(7001);

  select * into v_lead from public.leads where token = p_token for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.stage not in ('new', 'call_booked') then raise exception 'call_not_bookable'; end if;
  if p_minutes not in (30, 60) then raise exception 'invalid_duration'; end if;

  -- This lead's own current slot doesn't count against it, so a reschedule can overlap.
  if not exists (select 1 from public.available_slots(p_minutes, v_lead.id) s where s = p_start) then
    raise exception 'slot_unavailable';
  end if;

  update public.leads
     set call_at = p_start,
         call_minutes = p_minutes,
         call_link = (select meeting_url from public.booking_settings limit 1),
         stage = 'call_booked',
         reminder_sent_at = null
   where id = v_lead.id;
  return p_start;
end;
$$;

create or replace function public.cancel_lead_call(p_token uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.leads
     set call_at = null, call_minutes = null, call_link = null, stage = 'new', reminder_sent_at = null
   where token = p_token and stage = 'call_booked';
end;
$$;

create or replace function public.leads_after_insert_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.enqueue_notification(
    'lead_received', null, new.email, new.name,
    jsonb_build_object('token', new.token, 'summary', new.summary, 'service', new.service));
  perform public.notify_admins(
    'admin_new_lead',
    jsonb_build_object('lead_id', new.id, 'name', new.name, 'email', new.email, 'phone', new.phone,
                       'summary', new.summary, 'service', new.service));
  return new;
end;
$$;
create trigger leads_after_insert_notify_trg
  after insert on public.leads
  for each row execute function public.leads_after_insert_notify();

create or replace function public.leads_after_update_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_kind text;
  v_payload jsonb;
begin
  if old.call_at is null and new.call_at is not null then
    v_kind := 'call_booked';
  elsif old.call_at is not null and new.call_at is not null
        and (old.call_at <> new.call_at or old.call_minutes <> new.call_minutes) then
    v_kind := 'call_rescheduled';
  elsif old.call_at is not null and new.call_at is null and new.stage = 'new' then
    v_kind := 'call_cancelled';
  else
    return new;
  end if;

  v_payload := jsonb_build_object(
    'lead_id', new.id, 'token', new.token, 'name', new.name, 'email', new.email,
    'summary', new.summary, 'service', new.service,
    'call_at', coalesce(new.call_at, old.call_at),
    'call_minutes', coalesce(new.call_minutes, old.call_minutes),
    'call_link', new.call_link,
    'previous_call_at', old.call_at);
  perform public.enqueue_notification(v_kind, null, new.email, new.name, v_payload);
  perform public.notify_admins('admin_' || v_kind, v_payload);
  return new;
end;
$$;
create trigger leads_after_update_notify_trg
  after update on public.leads
  for each row execute function public.leads_after_update_notify();

-- Called once a day by the scheduler: remind people of calls in the next 25 hours.
create or replace function public.enqueue_call_reminders()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  l record;
  n int := 0;
begin
  for l in
    select * from public.leads
    where stage = 'call_booked' and call_at is not null and reminder_sent_at is null
      and call_at > now() and call_at <= now() + interval '25 hours'
    for update
  loop
    perform public.enqueue_notification(
      'call_reminder', null, l.email, l.name,
      jsonb_build_object('lead_id', l.id, 'token', l.token, 'name', l.name, 'summary', l.summary,
                         'service', l.service, 'call_at', l.call_at, 'call_minutes', l.call_minutes,
                         'call_link', l.call_link));
    update public.leads set reminder_sent_at = now() where id = l.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.enqueue_call_reminders() from public, anon, authenticated;
grant execute on function public.enqueue_call_reminders() to service_role;

-- ============================================================
-- 3. QUOTES
-- ============================================================
create or replace function public.convert_lead(
  p_lead uuid, p_client uuid, p_title text,
  p_total numeric, p_currency text, p_deposit_percent numeric
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_case uuid;
  v_deposit numeric;
  v_client public.users%rowtype;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  select * into v_lead from public.leads where id = p_lead for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.converted_case_id is not null then raise exception 'already_converted'; end if;
  select * into v_client from public.users where id = p_client and role = 'client';
  if not found then raise exception 'client_not_found'; end if;
  if p_total is null or p_total <= 0 then raise exception 'invalid_total'; end if;
  if p_currency not in ('USD', 'NGN') then raise exception 'invalid_currency'; end if;
  if p_deposit_percent is null or p_deposit_percent <= 0 or p_deposit_percent > 100 then
    raise exception 'invalid_deposit';
  end if;
  if length(btrim(coalesce(p_title, ''))) < 3 then raise exception 'invalid_title'; end if;

  v_deposit := round(p_total * p_deposit_percent / 100, 2);

  insert into public.cases (client_id, case_type, title, location_description, status,
                            deposit_required, quote_total, quote_currency)
  values (p_client, v_lead.service, btrim(p_title), v_lead.summary, 'awaiting_client_payment',
          true, p_total, p_currency)
  returning id into v_case;

  insert into public.payments (case_id, description, amount, currency, kind)
  values (v_case, 'Initial deposit', v_deposit, p_currency, 'deposit');
  if p_total - v_deposit > 0 then
    insert into public.payments (case_id, description, amount, currency, kind)
    values (v_case, 'Balance', p_total - v_deposit, p_currency, 'balance');
  end if;

  update public.leads
     set converted_case_id = v_case, client_id = p_client, stage = 'converted'
   where id = p_lead;

  perform public.enqueue_notification(
    'quote_ready', p_client, null, v_client.full_name,
    jsonb_build_object('case_id', v_case, 'case_title', btrim(p_title), 'case_type', v_lead.service,
                       'total', p_total, 'currency', p_currency, 'deposit', v_deposit,
                       'deposit_percent', p_deposit_percent));
  return v_case;
end;
$$;

-- ============================================================
-- 4. PAYMENTS
-- ============================================================
create or replace function public.payments_after_write_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_brief jsonb;
  v_client public.users%rowtype;
begin
  v_brief := public.case_brief(new.case_id);
  if tg_op = 'UPDATE' then
    if new.reported_at is not null and old.reported_at is distinct from new.reported_at
       and new.status in ('pending', 'overdue') then
      perform public.notify_admins(
        'admin_payment_reported',
        v_brief || jsonb_build_object('payment_id', new.id, 'description', new.description,
          'amount', new.amount, 'currency', new.currency, 'method', new.method,
          'reference', new.client_reference, 'ngn_amount', new.ngn_amount, 'fx_rate', new.fx_rate));
    end if;
    if new.status = 'paid' and old.status <> 'paid' then
      select * into v_client from public.users where id = (v_brief->>'client_id')::uuid;
      perform public.enqueue_notification(
        'payment_received', v_client.id, null, v_client.full_name,
        v_brief || jsonb_build_object('payment_id', new.id, 'description', new.description,
          'amount', new.amount, 'currency', new.currency, 'kind', new.kind, 'method', new.method),
        'pay:' || new.id, 1440);
    end if;
  end if;
  return new;
end;
$$;
create trigger payments_after_write_notify_trg
  after update on public.payments
  for each row execute function public.payments_after_write_notify();

-- ============================================================
-- 5. REPORTS AND DOCUMENTS (review gate)
-- ============================================================
create or replace function public.reports_after_write_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_case uuid := public.milestone_case_id(new.milestone_id);
  v_brief jsonb;
  v_client public.users%rowtype;
begin
  v_brief := public.case_brief(v_case);
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.users where id = new.submitted_by and role = 'admin') then
      perform public.notify_admins(
        'admin_review_needed',
        v_brief || jsonb_build_object('item', 'report', 'from', public.author_label(new.submitted_by)),
        'rev:' || v_case, 15);
    end if;
  elsif new.review_status = 'approved' and new.share_with_client
        and not (old.review_status = 'approved' and old.share_with_client) then
    select * into v_client from public.users where id = (v_brief->>'client_id')::uuid;
    perform public.enqueue_notification(
      'report_shared', v_client.id, null, v_client.full_name,
      v_brief || jsonb_build_object('item', 'report', 'flag', new.status_flag),
      'shared:' || v_case, 30);
  end if;
  return new;
end;
$$;
create trigger reports_after_write_notify_trg
  after insert or update on public.reports
  for each row execute function public.reports_after_write_notify();

create or replace function public.documents_after_write_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_brief jsonb := public.case_brief(new.case_id);
  v_client public.users%rowtype;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.users where id = new.uploaded_by and role = 'admin') then
      perform public.notify_admins(
        'admin_review_needed',
        v_brief || jsonb_build_object('item', 'document', 'from', public.author_label(new.uploaded_by)),
        'rev:' || new.case_id, 15);
    end if;
  elsif new.review_status = 'approved' and new.share_with_client
        and not (old.review_status = 'approved' and old.share_with_client) then
    select * into v_client from public.users where id = (v_brief->>'client_id')::uuid;
    perform public.enqueue_notification(
      'report_shared', v_client.id, null, v_client.full_name,
      v_brief || jsonb_build_object('item', 'document', 'doc_type', new.doc_type),
      'shared:' || new.case_id, 30);
  end if;
  return new;
end;
$$;
create trigger documents_after_write_notify_trg
  after insert or update on public.documents
  for each row execute function public.documents_after_write_notify();

-- ============================================================
-- 6. RECOMMENDATION, STEPS, STATUS, ASSIGNMENTS, MESSAGES
-- ============================================================
create or replace function public.recommendations_after_write_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_brief jsonb := public.case_brief(new.case_id);
  v_client public.users%rowtype;
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    select * into v_client from public.users where id = (v_brief->>'client_id')::uuid;
    perform public.enqueue_notification(
      'recommendation_published', v_client.id, null, v_client.full_name,
      v_brief || jsonb_build_object('verdict', new.verdict));
  end if;
  return new;
end;
$$;
create trigger recommendations_after_write_notify_trg
  after insert or update on public.case_recommendations
  for each row execute function public.recommendations_after_write_notify();

create or replace function public.milestones_after_update_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_brief jsonb;
  v_client public.users%rowtype;
begin
  if new.status is distinct from old.status and new.status in ('confirmed', 'issue_found') then
    v_brief := public.case_brief(new.case_id);
    select * into v_client from public.users where id = (v_brief->>'client_id')::uuid;
    perform public.enqueue_notification(
      'step_update', v_client.id, null, v_client.full_name,
      v_brief || jsonb_build_object('step', new.name, 'status', new.status),
      'step:' || new.id || ':' || new.status, 1440);
  end if;
  return new;
end;
$$;
create trigger milestones_after_update_notify_trg
  after update on public.milestones
  for each row execute function public.milestones_after_update_notify();

create or replace function public.cases_after_update_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_brief jsonb := public.case_brief(new.id);
  v_client public.users%rowtype;
  v_agent public.users%rowtype;
begin
  if new.status is distinct from old.status and new.status in ('in_progress', 'report_delivered', 'on_hold') then
    select * into v_client from public.users where id = new.client_id;
    perform public.enqueue_notification(
      'case_status', v_client.id, null, v_client.full_name,
      v_brief || jsonb_build_object('status', new.status));
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
create trigger cases_after_update_notify_trg
  after update on public.cases
  for each row execute function public.cases_after_update_notify();

create or replace function public.case_professionals_after_insert_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_pro public.users%rowtype;
begin
  select * into v_pro from public.users where id = new.professional_id;
  perform public.enqueue_notification(
    'assigned_to_case', v_pro.id, null, v_pro.full_name,
    (public.case_brief(new.case_id) - 'client_id')
      || jsonb_build_object('role', 'professional', 'specialty', v_pro.specialty));
  return new;
end;
$$;
create trigger case_professionals_after_insert_notify_trg
  after insert on public.case_professionals
  for each row execute function public.case_professionals_after_insert_notify();

-- Messages: the email only says there IS a message (never its text), and one
-- email per conversation per 10 minutes so a chatty thread doesn't flood inboxes.
create or replace function public.messages_after_insert_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_sender_role user_role;
  v_to public.users%rowtype;
  v_brief jsonb := public.case_brief(new.case_id);
begin
  select role into v_sender_role from public.users where id = new.sender_id;
  if v_sender_role = 'admin' then
    select * into v_to from public.users where id = new.thread_user_id;
    if found then
      perform public.enqueue_notification(
        'new_message', v_to.id, null, v_to.full_name,
        (v_brief - 'client_id') || jsonb_build_object('to_role', v_to.role),
        'msg:' || new.case_id || ':' || new.thread_user_id, 10);
    end if;
  else
    perform public.notify_admins(
      'admin_new_message',
      v_brief || jsonb_build_object('from', public.author_label(new.sender_id)),
      'msg:' || new.case_id || ':' || new.thread_user_id, 10);
  end if;
  return new;
end;
$$;
create trigger messages_after_insert_notify_trg
  after insert on public.messages
  for each row execute function public.messages_after_insert_notify();

commit;
