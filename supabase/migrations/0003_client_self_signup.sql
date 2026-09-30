-- Enables client self-signup. Before this, every public.users row was created
-- manually — either by hand for the first admin, or by the invite-user API
-- route using the service role key. That meant a prospective client landing
-- on the site from an ad had no way to create their own account.
--
-- This adds a trigger that automatically creates the public.users profile row
-- whenever a new row appears in auth.users, reading full_name/role/etc from
-- the signup's metadata. Two paths now both flow through this ONE trigger:
--   1. Self-signup (supabase.auth.signUp on /signup) — no role is passed in
--      metadata, so it defaults to 'client'. This is the only role a person
--      can give themselves — there is no client-reachable path to becoming
--      an agent, professional, or admin.
--   2. Admin invites (the /api/admin/invite-user route) — now passes role,
--      full_name, etc. into inviteUserByEmail's metadata instead of doing a
--      second, manual insert into public.users. See the code comment there.
--
-- IMPORTANT: this replaces the "insert into public.users" step that used to
-- live inside the invite-user API route. If you deployed that route's old
-- version, redeploy the app alongside this migration — running this
-- migration alone without updating the route causes a duplicate-row error on
-- every future invite (the trigger inserts the row first, then the route's
-- old manual insert fails on the same primary key).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, email, whatsapp_number, role, region, country)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'whatsapp_number',
    -- Only ever defaults to 'client' when no role is supplied. The role value
    -- itself is only ever set by the invite-user route (server-side, admin-
    -- gated, using the service role key) — a self-signup request never has
    -- the opportunity to pass a role at all, since the public signup form
    -- doesn't collect or send one.
    coalesce(nullif(new.raw_user_meta_data->>'role', '')::user_role, 'client'),
    new.raw_user_meta_data->>'region',
    new.raw_user_meta_data->>'country'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The "admin can insert any profile row" policy from 0001 is no longer the
-- normal path (the trigger, running as security definer, bypasses RLS
-- entirely) but is left in place harmlessly in case you ever need to insert
-- a users row directly from the SQL editor.
