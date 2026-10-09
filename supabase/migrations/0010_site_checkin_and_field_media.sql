-- 0010: Field agents must prove they are at the site, then capture live photos/video.
--  * cases get site coordinates + an allowed radius (set by an admin)
--  * booking_settings.min_site_captures = minimum live captures per site report
--  * site_visits records every GPS check-in (verified or not)
--  * media remembers how each file was captured (live camera / device camera / gallery)
--  * field agents can no longer insert reports/media directly: they must use
--    check_in_site() and then submit_field_report(), which enforce the rules.
-- Professionals and admins keep their existing flow (not site-gated).

alter table public.cases
  add column if not exists site_lat numeric check (site_lat between -90 and 90),
  add column if not exists site_lng numeric check (site_lng between -180 and 180),
  add column if not exists site_radius_m int not null default 250 check (site_radius_m between 25 and 5000);

alter table public.booking_settings
  add column if not exists min_site_captures int not null default 3 check (min_site_captures between 1 and 20);

alter table public.media
  add column if not exists capture_source text not null default 'legacy'
    check (capture_source in ('live','device_camera','gallery','legacy')),
  add column if not exists captured_lat numeric,
  add column if not exists captured_lng numeric;

alter table public.reports
  add column if not exists site_visit_id uuid,
  add column if not exists distance_m int;

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  agent_id uuid not null references public.users(id),
  lat numeric not null,
  lng numeric not null,
  accuracy_m numeric,
  distance_m int not null,
  verified boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists site_visits_lookup on public.site_visits (agent_id, milestone_id, created_at desc);
alter table public.site_visits enable row level security;
create policy "site_visits_select" on public.site_visits
  for select using (agent_id = auth.uid() or public.is_admin());
-- no insert/update/delete policies: rows are written only by check_in_site().

create or replace function public.haversine_m(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians((lat2 - lat1)::float8) / 2), 2) +
    cos(radians(lat1::float8)) * cos(radians(lat2::float8)) *
    power(sin(radians((lng2 - lng1)::float8) / 2), 2)));
$$;

-- Step 1: the agent's phone reports where it is; the server decides if that is the site.
create or replace function public.check_in_site(p_milestone uuid, p_lat numeric, p_lng numeric, p_accuracy numeric default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_case uuid := public.milestone_case_id(p_milestone);
  v_role text := public.current_user_role();
  c public.cases%rowtype;
  v_dist int; v_ok boolean; v_id uuid; v_slack int; v_min int;
begin
  if auth.uid() is null or v_case is null or not public.is_case_staff(v_case) then
    raise exception 'You are not assigned to this case.' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_position' using errcode = '22023';
  end if;
  select * into c from public.cases where id = v_case;
  if v_role = 'agent' and (c.site_lat is null or c.site_lng is null) then
    raise exception 'site_not_set' using errcode = 'P0001',
      hint = 'An admin must set this site''s map position before you can check in.';
  end if;
  if c.site_lat is null then
    return jsonb_build_object('verified', true, 'gated', false, 'min_captures', 0);
  end if;
  select coalesce(min_site_captures, 3) into v_min from public.booking_settings limit 1;
  v_min := coalesce(v_min, 3);
  v_dist := round(public.haversine_m(p_lat, p_lng, c.site_lat, c.site_lng))::int;
  -- A poor GPS fix may widen the allowance a little, but never beyond 150 m.
  v_slack := least(150, greatest(0, coalesce(round(p_accuracy)::int, 0)));
  v_ok := v_dist <= c.site_radius_m + v_slack;
  insert into public.site_visits (case_id, milestone_id, agent_id, lat, lng, accuracy_m, distance_m, verified)
  values (v_case, p_milestone, auth.uid(), p_lat, p_lng, p_accuracy, v_dist, v_ok)
  returning id into v_id;
  return jsonb_build_object('verified', v_ok, 'gated', true, 'distance_m', v_dist,
    'radius_m', c.site_radius_m, 'visit_id', v_id, 'min_captures', v_min);
end $$;

-- Step 2: one atomic call creates the report and its media, or nothing.
-- p_media: [{path, type: image|video, source: live|device_camera|gallery, lat, lng}]
create or replace function public.submit_field_report(
  p_id uuid, p_milestone uuid, p_findings text, p_flag report_status_flag, p_media jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_case uuid := public.milestone_case_id(p_milestone);
  v_role text := public.current_user_role();
  v_min int; v_live int := 0;
  v_visit public.site_visits%rowtype;
  m jsonb; v_type text; v_src text;
begin
  if auth.uid() is null or v_case is null or not public.is_case_staff(v_case)
     or v_role not in ('agent','professional') then
    raise exception 'You are not assigned to this case.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_findings,'')) = '' then
    raise exception 'Findings are required.' using errcode = '23514';
  end if;
  if p_media is null or jsonb_typeof(p_media) <> 'array' then p_media := '[]'::jsonb; end if;

  for m in select * from jsonb_array_elements(p_media) loop
    v_type := coalesce(m->>'type','image'); v_src := coalesce(m->>'source','gallery');
    if v_type not in ('image','video') or v_src not in ('live','device_camera','gallery') then
      raise exception 'invalid_media' using errcode = '22023';
    end if;
    if coalesce(m->>'path','') not like v_case::text || '/' || p_id::text || '/%' then
      raise exception 'invalid_media_path' using errcode = '22023';
    end if;
    if v_src in ('live','device_camera') then v_live := v_live + 1; end if;
  end loop;

  if v_role = 'agent' then
    select * into v_visit from public.site_visits
     where agent_id = auth.uid() and milestone_id = p_milestone and verified
       and created_at > now() - interval '4 hours'
     order by created_at desc limit 1;
    if not found then
      raise exception 'not_checked_in' using errcode = 'P0001',
        hint = 'Check in at the site (within the allowed distance) before submitting.';
    end if;
    select min_site_captures into v_min from public.booking_settings limit 1;
    v_min := coalesce(v_min, 3);
    if v_live < v_min then
      raise exception 'not_enough_captures' using errcode = 'P0001',
        hint = 'Take at least ' || v_min || ' live photos or videos at the site.';
    end if;
  end if;

  perform set_config('app.field_report_rpc', 'on', true);
  insert into public.reports (id, milestone_id, submitted_by, findings_summary, status_flag,
                              geo_lat, geo_lng, site_visit_id, distance_m)
  values (p_id, p_milestone, auth.uid(), p_findings, p_flag,
          v_visit.lat, v_visit.lng, v_visit.id, v_visit.distance_m);

  insert into public.media (report_id, storage_path, media_type, capture_source, captured_lat, captured_lng)
  select p_id, x->>'path', coalesce(x->>'type','image'), coalesce(x->>'source','gallery'),
         nullif(x->>'lat','')::numeric, nullif(x->>'lng','')::numeric
  from jsonb_array_elements(p_media) x;
  perform set_config('app.field_report_rpc', 'off', true);
  return p_id;
end $$;

-- Field agents may only create reports/media through submit_field_report().
create or replace function public.guard_agent_direct_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('app.field_report_rpc', true), 'off') <> 'on'
     and public.current_user_role() = 'agent' then
    raise exception 'Use the site check-in and report form.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists reports_guard_agent on public.reports;
create trigger reports_guard_agent before insert on public.reports
  for each row execute function public.guard_agent_direct_insert();
drop trigger if exists media_guard_agent on public.media;
create trigger media_guard_agent before insert on public.media
  for each row execute function public.guard_agent_direct_insert();

grant execute on function public.check_in_site(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.submit_field_report(uuid, uuid, text, report_status_flag, jsonb) to authenticated;
