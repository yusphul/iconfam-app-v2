-- 0014: When the client pays 100% up front there is no "deposit" -- it is simply the payment.
--  * convert_lead names the single invoice "Payment in full" (a part-payment is still
--    "Initial deposit" + "Balance").
--  * Existing one-invoice cases are renamed to match.
--  * The "payment received" email knows whether this was a full prepayment.

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
  values (v_case,
          case when p_total - v_deposit > 0 then 'Initial deposit' else 'Payment in full' end,
          v_deposit, p_currency, 'deposit');
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

-- Rename invoices that were created as "Initial deposit" but have no balance invoice.
update public.payments p
   set description = 'Payment in full'
 where p.kind = 'deposit'
   and p.description = 'Initial deposit'
   and not exists (select 1 from public.payments b where b.case_id = p.case_id and b.kind = 'balance');

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
          'amount', new.amount, 'currency', new.currency, 'kind', new.kind, 'method', new.method,
          'full_prepay', (new.kind = 'deposit'
                          and not exists (select 1 from public.payments b
                                          where b.case_id = new.case_id and b.kind = 'balance'))),
        'pay:' || new.id, 1440);
    end if;
  end if;
  return new;
end;
$$;
