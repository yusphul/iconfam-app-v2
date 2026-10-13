-- 0021: Admin button "Retry failed emails".
-- retry_failed_emails() puts emails that gave up (5 failed attempts) back in the queue.
-- Only emails from the last 3 days are retried, matching the sender's own window,
-- so old notices (a call that already happened) are never sent late.
-- Returns how many emails were put back.

create or replace function public.retry_failed_emails()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_n int;
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  update public.notification_outbox
     set attempts = 0, claimed_at = null, last_error = null
   where sent_at is null
     and attempts >= 5
     and created_at > now() - interval '3 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.retry_failed_emails() from public, anon;
grant execute on function public.retry_failed_emails() to authenticated;
