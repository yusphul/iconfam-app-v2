-- 0009: visit-based pricing (site inspection and farm oversight) and itemised quotes.
--
-- Property verification and documentation are still quoted by hand after the
-- intake call. Site inspection and farm/agribusiness oversight are priced per
-- visit:
--
--     price = iConfam service fee + field costs (agent wage + transport + data)
--
--   1. booking_settings.visit_fee_usd   the service fee per visit (default 60 USD)
--   2. visit_zones                      field costs per distance zone, in naira
--                                       (admin-only; edit them in /admin/settings)
--   3. cases.quote_lines                the itemised quote the client sees
--   4. convert_lead(... p_lines)        stores the lines, checks they add up
--
-- Safe to run on a live database: only adds objects and a defaulted column, and
-- replaces convert_lead with a version that has one extra optional argument.
-- The naira amounts seeded below are placeholders; replace them with real
-- figures from your agents in /admin/settings.

begin;

-- ============================================================
-- 1. SERVICE FEE
-- ============================================================
alter table public.booking_settings
  add column visit_fee_usd numeric not null default 60 check (visit_fee_usd >= 0);

-- ============================================================
-- 2. FIELD COSTS BY ZONE
-- ============================================================
create table public.visit_zones (
  code text primary key check (code ~ '^[A-Za-z0-9_-]{1,12}$'),
  label text not null check (length(btrim(label)) between 1 and 80),
  wage_ngn numeric not null default 0 check (wage_ngn >= 0),
  transport_ngn numeric not null default 0 check (transport_ngn >= 0),
  data_ngn numeric not null default 0 check (data_ngn >= 0),
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create trigger visit_zones_touch_updated_at
  before update on public.visit_zones
  for each row execute function public.touch_updated_at();

alter table public.visit_zones enable row level security;
create policy "visit_zones_admin_all" on public.visit_zones
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.visit_zones (code, label, wage_ngn, transport_ngn, data_ngn, sort_order) values
  ('A', 'Same city (e.g. Lagos mainland)',        20000,  8000, 2000, 1),
  ('B', 'Elsewhere in the state or next state',   25000, 25000, 2000, 2),
  ('C', 'Remote site or farm',                    30000, 70000, 3000, 3);

-- ============================================================
-- 3. ITEMISED QUOTE
-- ============================================================
alter table public.cases add column quote_lines jsonb;

-- ============================================================
-- 4. LEAD -> CASE, now with optional quote lines
-- ============================================================
drop function if exists public.convert_lead(uuid, uuid, text, numeric, text, numeric);

create or replace function public.convert_lead(
  p_lead uuid, p_client uuid, p_title text,
  p_total numeric, p_currency text, p_deposit_percent numeric,
  p_lines jsonb default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_case uuid;
  v_deposit numeric;
  v_client public.users%rowtype;
  v_line jsonb;
  v_sum numeric := 0;
  v_clean jsonb := null;
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

  -- Itemised lines: [{"label": "...", "amount": 12.34}, ...] that must add up to the total.
  if p_lines is not null and jsonb_typeof(p_lines) <> 'null' then
    if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 20 then
      raise exception 'invalid_lines';
    end if;
    v_clean := '[]'::jsonb;
    for v_line in select * from jsonb_array_elements(p_lines) loop
      if jsonb_typeof(v_line) <> 'object'
         or jsonb_typeof(v_line -> 'label') <> 'string'
         or jsonb_typeof(v_line -> 'amount') <> 'number'
         or length(btrim(v_line ->> 'label')) not between 1 and 120
         or (v_line ->> 'amount')::numeric < 0 then
        raise exception 'invalid_lines';
      end if;
      v_sum := v_sum + (v_line ->> 'amount')::numeric;
      v_clean := v_clean || jsonb_build_array(jsonb_build_object(
        'label', btrim(v_line ->> 'label'),
        'amount', round((v_line ->> 'amount')::numeric, 2)));
    end loop;
    if abs(v_sum - p_total) > 0.05 then raise exception 'lines_do_not_match_total'; end if;
  end if;

  v_deposit := round(p_total * p_deposit_percent / 100, 2);

  insert into public.cases (client_id, case_type, title, location_description, status,
                            deposit_required, quote_total, quote_currency, quote_lines)
  values (p_client, v_lead.service, btrim(p_title), v_lead.summary, 'awaiting_client_payment',
          true, p_total, p_currency, v_clean)
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
grant execute on function public.convert_lead(uuid, uuid, text, numeric, text, numeric, jsonb) to authenticated;

commit;
