-- 0012: Admins can delete a case that is no longer needed.
--  * delete_case() removes the case and everything attached to it (milestones, reports,
--    media rows, documents, payments, messages, notes, recommendations, check-ins).
--  * A case with paid invoices is refused unless the caller passes p_force = true,
--    because deleting it also removes that income from the books.
--  * The request it came from is marked "lost" and any email still waiting to be
--    sent about the case is dropped.
--  * Admins get permission to list and remove the case's stored files.

create or replace function public.delete_case(p_case uuid, p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_paid int;
  v_paid_total numeric;
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if not exists (select 1 from public.cases where id = p_case) then
    raise exception 'case_not_found';
  end if;

  select count(*), coalesce(sum(amount), 0) into v_paid, v_paid_total
  from public.payments where case_id = p_case and status = 'paid';
  if v_paid > 0 and not coalesce(p_force, false) then
    raise exception 'has_paid_payments' using hint = v_paid || ' paid invoice(s) would be removed.';
  end if;

  update public.leads set stage = 'lost' where converted_case_id = p_case;
  delete from public.notification_outbox
   where sent_at is null and payload ->> 'case_id' = p_case::text;
  delete from public.cases where id = p_case;

  return jsonb_build_object('deleted', true, 'paid_invoices_removed', v_paid);
end;
$$;
grant execute on function public.delete_case(uuid, boolean) to authenticated;

-- Storage: only admins may list or remove files in bulk.
create policy "media_bucket_admin_read" on storage.objects
  for select using (bucket_id = 'iconfam-media' and public.is_admin());
create policy "media_bucket_admin_delete" on storage.objects
  for delete using (bucket_id = 'iconfam-media' and public.is_admin());
create policy "documents_bucket_admin_read" on storage.objects
  for select using (bucket_id = 'iconfam-documents' and public.is_admin());
create policy "documents_bucket_admin_delete" on storage.objects
  for delete using (bucket_id = 'iconfam-documents' and public.is_admin());
