-- 0015: Clients can upload a receipt (photo or PDF) instead of typing a transaction ID.
--  * payments.receipt_path points at the file in a new private bucket, iconfam-receipts.
--    Files live at <case_id>/<payment_id>/<filename>.
--  * report_payment() accepts a reference, a receipt, or both. One of them is required.
--  * The client who owns the case can upload to and read their own receipts; admins can
--    read and remove all of them (needed for case delete).
--  * The "payment reported" email to admins says whether a receipt is attached.
-- Run AFTER 0014.

alter table public.payments add column if not exists receipt_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'iconfam-receipts', 'iconfam-receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts_client_upload" on storage.objects;
create policy "receipts_client_upload" on storage.objects
  for insert with check (
    bucket_id = 'iconfam-receipts'
    and (
      public.is_admin()
      or public.is_case_client(public.try_uuid((storage.foldername(name))[1]))
    )
  );

drop policy if exists "receipts_read" on storage.objects;
create policy "receipts_read" on storage.objects
  for select using (
    bucket_id = 'iconfam-receipts'
    and (
      public.is_admin()
      or public.is_case_client(public.try_uuid((storage.foldername(name))[1]))
    )
  );

drop policy if exists "receipts_admin_delete" on storage.objects;
create policy "receipts_admin_delete" on storage.objects
  for delete using (bucket_id = 'iconfam-receipts' and public.is_admin());

-- Replace the 3-argument version.
drop function if exists public.report_payment(uuid, text, text);

create or replace function public.report_payment(
  p_payment uuid,
  p_method text,
  p_reference text default null,
  p_receipt_path text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pay public.payments%rowtype;
  v_rate numeric;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_receipt text := nullif(btrim(coalesce(p_receipt_path, '')), '');
begin
  select * into v_pay from public.payments where id = p_payment;
  if not found or not public.is_case_client(v_pay.case_id) then
    raise exception 'payment_not_found';
  end if;
  if v_pay.status not in ('pending', 'overdue') then raise exception 'payment_not_open'; end if;
  if p_method not in ('bank_usd', 'bank_ngn') then raise exception 'invalid_method'; end if;

  if v_ref is not null and (length(v_ref) < 3 or length(v_ref) > 200) then
    raise exception 'invalid_reference';
  end if;
  if v_receipt is not null
     and (v_receipt not like (v_pay.case_id::text || '/' || v_pay.id::text || '/%') or length(v_receipt) > 300) then
    raise exception 'invalid_receipt';
  end if;
  if v_ref is null and v_receipt is null then
    raise exception 'reference_or_receipt_required';
  end if;

  if p_method = 'bank_ngn' and v_pay.currency = 'USD' then
    select usd_to_ngn_rate into v_rate from public.booking_settings limit 1;
    if v_rate is null then raise exception 'no_ngn_rate'; end if;
    update public.payments
       set method = p_method, client_reference = v_ref, receipt_path = v_receipt, reported_at = now(),
           fx_rate = v_rate, ngn_amount = round(v_pay.amount * v_rate, 0)
     where id = p_payment;
  else
    update public.payments
       set method = p_method, client_reference = v_ref, receipt_path = v_receipt, reported_at = now(),
           fx_rate = null, ngn_amount = null
     where id = p_payment;
  end if;
  perform public.bump_case(v_pay.case_id);
end;
$$;
grant execute on function public.report_payment(uuid, text, text, text) to authenticated;

-- Admin email: say whether a receipt came with the report.
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
          'reference', new.client_reference, 'has_receipt', (new.receipt_path is not null),
          'ngn_amount', new.ngn_amount, 'fx_rate', new.fx_rate));
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
