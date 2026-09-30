-- Tightens storage access from "any logged-in user can read/write any file in
-- either bucket" down to "only someone with real access to the case that file
-- belongs to." The original policies in 0001 only checked auth.role() =
-- 'authenticated' — table-level RLS already restricted which *rows* a user could
-- query, but the actual file bytes in Storage were not scoped the same way.
--
-- Both buckets store files under a path starting with the case's UUID:
--   iconfam-media:     <case_id>/<report_id>/<filename>
--   iconfam-documents: <case_id>/<filename>
-- storage.foldername(name) returns the folder segments of the path, so element
-- [1] is always the case_id regardless of how many segments follow.

drop policy if exists "media_bucket_authenticated_read" on storage.objects;
drop policy if exists "media_bucket_authenticated_write" on storage.objects;
drop policy if exists "documents_bucket_authenticated_read" on storage.objects;
drop policy if exists "documents_bucket_authenticated_write" on storage.objects;

create policy "media_bucket_scoped_read" on storage.objects
  for select using (
    bucket_id = 'iconfam-media'
    and exists (
      select 1 from public.cases c
      where c.id::text = (storage.foldername(name))[1]
        and (
          c.client_id = auth.uid()
          or c.assigned_agent_id = auth.uid()
          or c.assigned_professional_id = auth.uid()
          or public.current_user_role() = 'admin'
        )
    )
  );

create policy "media_bucket_scoped_write" on storage.objects
  for insert with check (
    bucket_id = 'iconfam-media'
    and public.current_user_role() in ('agent', 'professional', 'admin')
    and exists (
      select 1 from public.cases c
      where c.id::text = (storage.foldername(name))[1]
        and (
          c.assigned_agent_id = auth.uid()
          or c.assigned_professional_id = auth.uid()
          or public.current_user_role() = 'admin'
        )
    )
  );

create policy "documents_bucket_scoped_read" on storage.objects
  for select using (
    bucket_id = 'iconfam-documents'
    and exists (
      select 1 from public.cases c
      where c.id::text = (storage.foldername(name))[1]
        and (
          c.client_id = auth.uid()
          or c.assigned_professional_id = auth.uid()
          or public.current_user_role() = 'admin'
        )
    )
  );

create policy "documents_bucket_scoped_write" on storage.objects
  for insert with check (
    bucket_id = 'iconfam-documents'
    and public.current_user_role() in ('professional', 'admin')
    and exists (
      select 1 from public.cases c
      where c.id::text = (storage.foldername(name))[1]
        and (
          c.assigned_professional_id = auth.uid()
          or public.current_user_role() = 'admin'
        )
    )
  );
