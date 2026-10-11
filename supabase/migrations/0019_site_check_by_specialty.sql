-- 0019: Who has to be at the site? Field agents always. Professionals depend on what they do:
-- a lawyer checks documents and has no reason to stand on the plot, a surveyor or an
-- agronomist does. The admin chooses which specialties must check in (Settings).
--  * booking_settings.site_check_specialties: the specialties that must check in at the site.
--    Default: surveyor, structural engineer, quantity surveyor, estate valuer, agronomist.
--  * requires_site_check(): true for a field agent, or a professional whose specialty is on that list.
--  * check_in_site, submit_field_report and the direct-insert guard use it instead of "role = agent".
--  * my_site_check_required(): lets the app know, so the form can show or hide the check-in step.
-- Run AFTER 0018.

alter table public.booking_settings
  add column if not exists site_check_specialties text[] not null
  default array['surveyor','structural_engineer','quantity_surveyor','estate_valuer','agronomist'];

create or replace function public.requires_site_check(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select case u.role
      when 'agent' then true
      when 'professional' then coalesce(u.specialty::text = any (
        coalesce((select bs.site_check_specialties from public.booking_settings bs limit 1), array[]::text[])), false)
      else false
    end
    from public.users u where u.id = p_user
  ), false);
$$;
grant execute on function public.requires_site_check(uuid) to authenticated;

create or replace function public.my_site_check_required()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.requires_site_check(auth.uid()); $$;
grant execute on function public.my_site_check_required() to authenticated;

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
  if public.requires_site_check() and (c.site_lat is null or c.site_lng is null) then
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

  if public.requires_site_check() then
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

-- Reports and media for anyone who must check in go through submit_field_report() only.
create or replace function public.guard_agent_direct_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('app.field_report_rpc', true), 'off') <> 'on'
     and public.requires_site_check() then
    raise exception 'Use the site check-in and report form.' using errcode = '42501';
  end if;
  return new;
end $$;

grant execute on function public.check_in_site(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.submit_field_report(uuid, uuid, text, report_status_flag, jsonb) to authenticated;
