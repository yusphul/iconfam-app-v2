-- 0011: The client gives the property/farm address up front; the case keeps it, an admin
-- pins it on the map, and the field agent's check-in is measured against that pin.

alter table public.leads add column if not exists site_address text
  check (site_address is null or length(site_address) between 5 and 300);
alter table public.cases add column if not exists site_address text
  check (site_address is null or length(site_address) between 5 and 300);

-- submit_lead gains the address (optional at this level so older callers keep working;
-- the website form and API require it).
drop function if exists public.submit_lead(text, text, text, case_type, text, text);
create or replace function public.submit_lead(
  p_name text, p_email text, p_phone text, p_service case_type,
  p_summary text, p_details text, p_site_address text default null
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
  p_site_address := nullif(btrim(coalesce(p_site_address, '')), '');
  if length(p_name) < 2 or length(p_name) > 200 then
    raise exception 'invalid_name';
  end if;
  if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(p_email) > 320 then
    raise exception 'invalid_email';
  end if;
  if length(p_summary) < 3 or length(p_summary) > 300 then
    raise exception 'invalid_summary';
  end if;
  if p_site_address is not null and length(p_site_address) not between 5 and 300 then
    raise exception 'invalid_address';
  end if;
  if length(coalesce(p_details, '')) > 5000 or length(coalesce(p_phone, '')) > 60 then
    raise exception 'too_long';
  end if;
  if (select count(*) from public.leads
      where lower(email) = lower(p_email) and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many_requests';
  end if;

  select u.id into v_client from public.users u where u.id = auth.uid() and u.role = 'client';

  insert into public.leads (client_id, name, email, phone, service, summary, details, site_address)
  values (v_client, p_name, p_email, nullif(btrim(coalesce(p_phone, '')), ''), p_service,
          p_summary, nullif(btrim(coalesce(p_details, '')), ''), p_site_address)
  returning id, leads.token into v_id, v_token;

  return query select v_id, v_token;
end;
$$;
grant execute on function public.submit_lead(text, text, text, case_type, text, text, text) to anon, authenticated;

-- convert_lead: carry the address onto the case.
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

  insert into public.cases (client_id, case_type, title, location_description, site_address, status,
                            deposit_required, quote_total, quote_currency, quote_lines)
  values (p_client, v_lead.service, btrim(p_title), coalesce(v_lead.site_address, v_lead.summary),
          v_lead.site_address, 'awaiting_client_payment',
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

-- Only an admin can pin a site. A client-created case can never arrive with its own
-- coordinates, so nobody can point the check-in at somewhere convenient.
create or replace function public.cases_strip_site_pin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.site_lat := null; new.site_lng := null; new.site_radius_m := 250;
  end if;
  return new;
end $$;
drop trigger if exists cases_strip_site_pin on public.cases;
create trigger cases_strip_site_pin before insert on public.cases
  for each row execute function public.cases_strip_site_pin();
