-- 0007: the client journey — interest -> intake call -> scope & quote -> deposit -> work.
--
--   1. leads            every expression of interest (signed in or not)
--      lead_intake      admin-only notes taken on the intake call
--   2. booking_settings / availability_rules   when calls can be booked
--      RPCs: submit_lead, lead_booking_info, available_slots, book_lead_call,
--            cancel_lead_call (callable by the public, validated inside)
--   3. payments       kind / method / reference / NGN equivalent
--      RPCs: payment_instructions, report_payment (client says "I've paid")
--   4. deposit gate   a case created from a quote cannot start (be in_progress,
--                     or get a field agent / professional) until its deposit
--                     is paid or waived.
--
-- Safe to run on a live database: only adds objects and nullable/defaulted
-- columns. Existing cases keep deposit_required = false, so nothing already
-- running is blocked.

begin;

-- ============================================================
-- 1. LEADS
-- ============================================================
create type public.lead_stage as enum ('new', 'call_booked', 'call_done', 'converted', 'lost');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),   -- the secret in the booking link
  client_id uuid references public.users(id),            -- set when a signed-in client asked
  name text not null,
  email text not null,
  phone text,
  service case_type not null,
  summary text not null,
  details text,
  stage public.lead_stage not null default 'new',
  call_at timestamptz,
  call_minutes int check (call_minutes in (30, 60)),
  call_link text,
  converted_case_id uuid references public.cases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((call_at is null) = (call_minutes is null))
);
create index leads_stage_idx on public.leads (stage, created_at desc);
create index leads_email_idx on public.leads (lower(email));
create index leads_call_idx on public.leads (call_at) where call_at is not null;

create table public.lead_intake (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  process_stage text check (process_stage in ('not_started', 'started', 'stuck', 'unsure')),
  documents_held text,
  goal text,
  deadline text,
  notes text,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

create trigger leads_touch_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

alter table public.leads enable row level security;
alter table public.lead_intake enable row level security;

-- Nobody inserts directly: the public goes through submit_lead(). Clients can
-- read their own requests (not the intake notes); admins can do everything.
create policy "leads_admin_all" on public.leads
  for all using (public.is_admin()) with check (public.is_admin());
create policy "leads_select_own" on public.leads
  for select using (client_id = auth.uid());
create policy "lead_intake_admin_all" on public.lead_intake
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 2. BOOKING SETTINGS + AVAILABILITY
-- ============================================================
create table public.booking_settings (
  id boolean primary key default true check (id),         -- one row only
  timezone text not null default 'America/Chicago',       -- the zone availability_rules are written in
  slot_step_minutes int not null default 30 check (slot_step_minutes between 15 and 120),
  min_notice_hours int not null default 12 check (min_notice_hours >= 0),
  horizon_days int not null default 21 check (horizon_days between 1 and 90),
  meeting_url text,                                       -- the video link people are given
  bank_instructions_usd text,
  bank_instructions_ngn text,
  usd_to_ngn_rate numeric check (usd_to_ngn_rate is null or usd_to_ngn_rate > 0),
  updated_at timestamptz not null default now()
);
insert into public.booking_settings (id) values (true);

-- Refuse a time zone name Postgres doesn't know, so a typo can't break booking.
create or replace function public.booking_settings_check_tz()
returns trigger
language plpgsql
as $$
begin
  perform now() at time zone new.timezone;
  return new;
end;
$$;
create trigger booking_settings_check_tz_trg
  before insert or update on public.booking_settings
  for each row execute function public.booking_settings_check_tz();

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = Sunday, as in extract(dow)
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

alter table public.booking_settings enable row level security;
alter table public.availability_rules enable row level security;
create policy "booking_settings_admin_all" on public.booking_settings
  for all using (public.is_admin()) with check (public.is_admin());
create policy "availability_rules_admin_all" on public.availability_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- Sensible default: weekdays 10:00-16:00 in the settings time zone.
insert into public.availability_rules (weekday, start_time, end_time)
select d, time '10:00', time '16:00' from generate_series(1, 5) d;

-- Free slot start times for a call of p_minutes. Computed in the settings time
-- zone (so daylight saving is handled), minus anything that overlaps a call that
-- is already booked.
create or replace function public.available_slots(p_minutes int)
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
        and tstzrange(l.call_at, l.call_at + make_interval(mins => l.call_minutes))
            && tstzrange(c.start_at, c.start_at + make_interval(mins => p_minutes))
    )
  order by c.start_at;
$$;
grant execute on function public.available_slots(int) to anon, authenticated;

-- ============================================================
-- 3. PUBLIC RPCs
-- ============================================================
-- Records interest. Works for visitors and signed-in clients alike; a signed-in
-- client's request is linked to their account so it shows in their portal.
create or replace function public.submit_lead(
  p_name text, p_email text, p_phone text, p_service case_type,
  p_summary text, p_details text
)
returns table (lead_id uuid, token uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_id uuid;
  v_token uuid;
begin
  p_name := btrim(coalesce(p_name, ''));
  p_email := btrim(coalesce(p_email, ''));
  p_summary := btrim(coalesce(p_summary, ''));
  if length(p_name) < 2 or length(p_name) > 200 then
    raise exception 'invalid_name';
  end if;
  if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(p_email) > 320 then
    raise exception 'invalid_email';
  end if;
  if length(p_summary) < 3 or length(p_summary) > 300 then
    raise exception 'invalid_summary';
  end if;
  if length(coalesce(p_details, '')) > 5000 or length(coalesce(p_phone, '')) > 60 then
    raise exception 'too_long';
  end if;
  -- Cheap flood guard: at most 5 requests per address per day.
  if (select count(*) from public.leads
      where lower(email) = lower(p_email) and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many_requests';
  end if;

  select u.id into v_client from public.users u where u.id = auth.uid() and u.role = 'client';

  insert into public.leads (client_id, name, email, phone, service, summary, details)
  values (v_client, p_name, p_email, nullif(btrim(coalesce(p_phone, '')), ''), p_service,
          p_summary, nullif(btrim(coalesce(p_details, '')), ''))
  returning id, leads.token into v_id, v_token;

  return query select v_id, v_token;
end;
$$;
grant execute on function public.submit_lead(text, text, text, case_type, text, text) to anon, authenticated;

-- What the booking page may show to whoever holds the link.
create or replace function public.lead_booking_info(p_token uuid)
returns table (
  name text, service case_type, summary text, stage public.lead_stage,
  call_at timestamptz, call_minutes int, call_link text, timezone text
)
language sql stable security definer set search_path = public
as $$
  select l.name, l.service, l.summary, l.stage, l.call_at, l.call_minutes,
         case when l.call_at is not null then l.call_link end,
         (select timezone from public.booking_settings limit 1)
  from public.leads l where l.token = p_token;
$$;
grant execute on function public.lead_booking_info(uuid) to anon, authenticated;

create or replace function public.book_lead_call(p_token uuid, p_start timestamptz, p_minutes int)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
begin
  -- One booking at a time, so two people can't take the same slot.
  perform pg_advisory_xact_lock(7001);

  select * into v_lead from public.leads where token = p_token for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.stage not in ('new', 'call_booked') then raise exception 'call_not_bookable'; end if;
  if p_minutes not in (30, 60) then raise exception 'invalid_duration'; end if;

  -- Free this lead's previous slot first so a reschedule can overlap it.
  update public.leads set call_at = null, call_minutes = null where id = v_lead.id;

  if not exists (select 1 from public.available_slots(p_minutes) s where s = p_start) then
    raise exception 'slot_unavailable';
  end if;

  update public.leads
     set call_at = p_start,
         call_minutes = p_minutes,
         call_link = (select meeting_url from public.booking_settings limit 1),
         stage = 'call_booked'
   where id = v_lead.id;
  return p_start;
end;
$$;
grant execute on function public.book_lead_call(uuid, timestamptz, int) to anon, authenticated;

create or replace function public.cancel_lead_call(p_token uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.leads
     set call_at = null, call_minutes = null, call_link = null, stage = 'new'
   where token = p_token and stage = 'call_booked';
end;
$$;
grant execute on function public.cancel_lead_call(uuid) to anon, authenticated;

-- ============================================================
-- 4. PAYMENTS
-- ============================================================
alter table public.payments
  add column kind text not null default 'other' check (kind in ('deposit', 'balance', 'milestone', 'other')),
  add column method text check (method in ('card', 'bank_usd', 'bank_ngn', 'other')),
  add column client_reference text,       -- the transfer reference the client typed in
  add column reported_at timestamptz,     -- when the client said "I've paid"
  add column ngn_amount numeric,          -- naira equivalent quoted for NGN transfers
  add column fx_rate numeric,             -- the USD->NGN rate that was applied
  add column confirmed_by uuid references public.users(id),
  add column external_id text;            -- e.g. Stripe checkout session id

alter table public.cases
  add column deposit_required boolean not null default false,
  add column quote_total numeric,
  add column quote_currency text;

-- Stamp paid_at / confirmed_by whenever a payment is settled.
create or replace function public.payments_before_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('paid', 'waived') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.paid_at := coalesce(new.paid_at, now());
    new.confirmed_by := coalesce(new.confirmed_by, auth.uid());
  elsif new.status not in ('paid', 'waived') then
    new.paid_at := null;
    new.confirmed_by := null;
  end if;
  return new;
end;
$$;
create trigger payments_before_write_trg
  before insert or update on public.payments
  for each row execute function public.payments_before_write();

-- Bank details and the fixed naira rate are only shown to signed-in people.
create or replace function public.payment_instructions()
returns table (bank_usd text, bank_ngn text, usd_to_ngn_rate numeric)
language sql stable security definer set search_path = public
as $$
  select bank_instructions_usd, bank_instructions_ngn, usd_to_ngn_rate
  from public.booking_settings
  where auth.uid() is not null
  limit 1;
$$;
grant execute on function public.payment_instructions() to authenticated;

-- The client says "I've paid by transfer, here's the reference". An admin still
-- has to confirm receipt; this only records the claim and fixes the naira amount.
create or replace function public.report_payment(p_payment uuid, p_method text, p_reference text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pay public.payments%rowtype;
  v_rate numeric;
begin
  select * into v_pay from public.payments where id = p_payment;
  if not found or not public.is_case_client(v_pay.case_id) then
    raise exception 'payment_not_found';
  end if;
  if v_pay.status not in ('pending', 'overdue') then raise exception 'payment_not_open'; end if;
  if p_method not in ('bank_usd', 'bank_ngn') then raise exception 'invalid_method'; end if;
  if length(btrim(coalesce(p_reference, ''))) < 3 or length(p_reference) > 200 then
    raise exception 'invalid_reference';
  end if;

  if p_method = 'bank_ngn' and v_pay.currency = 'USD' then
    select usd_to_ngn_rate into v_rate from public.booking_settings limit 1;
    if v_rate is null then raise exception 'no_ngn_rate'; end if;
    update public.payments
       set method = p_method, client_reference = btrim(p_reference), reported_at = now(),
           fx_rate = v_rate, ngn_amount = round(v_pay.amount * v_rate, 0)
     where id = p_payment;
  else
    update public.payments
       set method = p_method, client_reference = btrim(p_reference), reported_at = now(),
           fx_rate = null, ngn_amount = null
     where id = p_payment;
  end if;
  perform public.bump_case(v_pay.case_id);
end;
$$;
grant execute on function public.report_payment(uuid, text, text) to authenticated;

-- ============================================================
-- 5. DEPOSIT GATE
-- ============================================================
create or replace function public.deposit_cleared(p_case uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not coalesce((select deposit_required from public.cases where id = p_case), false)
      or exists (
        select 1 from public.payments
        where case_id = p_case and kind = 'deposit' and status in ('paid', 'waived')
      );
$$;

create or replace function public.cases_deposit_gate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.deposit_required and not exists (
       select 1 from public.payments
       where case_id = new.id and kind = 'deposit' and status in ('paid', 'waived')
     ) then
    if new.status in ('in_progress', 'report_delivered')
       and (tg_op = 'INSERT' or old.status is distinct from new.status) then
      raise exception 'deposit_required: the initial deposit has not been paid yet';
    end if;
    if new.assigned_agent_id is not null
       and (tg_op = 'INSERT' or old.assigned_agent_id is distinct from new.assigned_agent_id) then
      raise exception 'deposit_required: the initial deposit has not been paid yet';
    end if;
  end if;
  return new;
end;
$$;
create trigger cases_deposit_gate_trg
  before insert or update on public.cases
  for each row execute function public.cases_deposit_gate();

create or replace function public.case_professionals_deposit_gate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.deposit_cleared(new.case_id) then
    raise exception 'deposit_required: the initial deposit has not been paid yet';
  end if;
  return new;
end;
$$;
create trigger case_professionals_deposit_gate_trg
  before insert on public.case_professionals
  for each row execute function public.case_professionals_deposit_gate();

-- ============================================================
-- 6. LEAD -> CASE (admin)
-- ============================================================
-- Turns a lead into a case with a quote: a deposit payment (due now) and the
-- balance. The case waits in awaiting_client_payment until the deposit clears.
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
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  select * into v_lead from public.leads where id = p_lead for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.converted_case_id is not null then raise exception 'already_converted'; end if;
  if not exists (select 1 from public.users where id = p_client and role = 'client') then
    raise exception 'client_not_found';
  end if;
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
  return v_case;
end;
$$;
grant execute on function public.convert_lead(uuid, uuid, text, numeric, text, numeric) to authenticated;

commit;
