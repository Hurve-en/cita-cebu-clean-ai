-- Custom security layer: reviewed SQL managed alongside Drizzle schema.
-- Applied by Supabase CLI after the generated tables.
revoke create on schema public from public, anon, authenticated;
create schema cebu_private;
revoke all on schema cebu_private from public, anon, authenticated;
grant usage on schema cebu_private to authenticated;

-- Supabase project defaults can give broad grants to new public relations.
-- Remove those explicitly; clients receive read grants only below.
revoke all on table public.barangays, public.profiles,
  public.account_access, public.officer_assignments from public, anon, authenticated;
grant select on table public.barangays, public.profiles,
  public.account_access, public.officer_assignments to authenticated;

-- No actor parameter: an end user cannot ask this helper to inspect someone else.
create function cebu_private.is_eligible()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.account_access a
    join auth.users u on u.id = a.user_id
    where a.user_id = (select auth.uid())
      and a.enabled and a.provisioning_state = 'ready'
      and u.email_confirmed_at is not null
      and (
        a.product_role <> 'officer'
        or exists (
          select 1 from public.officer_assignments oa
          join public.barangays b on b.id = oa.barangay_id
          where oa.officer_id = a.user_id and oa.effective_to is null and b.enabled
        )
      )
  );
$$;
revoke all on function cebu_private.is_eligible() from public, anon, authenticated;
grant execute on function cebu_private.is_eligible() to authenticated;

create policy profile_read_own on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) and (select cebu_private.is_eligible()));
-- Minimal own access is readable even when disabled/pending, for honest routing.
create policy access_read_own on public.account_access for select to authenticated
  using (user_id = (select auth.uid()));
create policy enabled_barangay_read on public.barangays for select to authenticated
  using (enabled and (select cebu_private.is_eligible()));
create policy assignment_read_own on public.officer_assignments for select to authenticated
  using (officer_id = (select auth.uid()) and (select cebu_private.is_eligible()));

-- Auth bootstrap: role/assignment claims in raw_user_meta_data are NEVER trusted.
-- The server-only app_metadata marker reserves an ineligible invited officer.
-- Future trusted provisioning must set this marker before issuing its invite.
create function cebu_private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  safe_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  officer_invitation boolean := coalesce(
    new.raw_app_meta_data ->> 'cebuclean_provisioning' = 'officer', false
  );
begin
  if char_length(safe_name) not between 2 and 80 then
    safe_name := 'Resident';
  end if;
  insert into public.profiles(user_id, display_name) values (new.id, safe_name);
  insert into public.account_access(user_id, product_role, enabled, provisioning_state)
  values (
    new.id,
    case when officer_invitation then 'officer'::public.cebu_role else 'resident'::public.cebu_role end,
    not officer_invitation,
    case when officer_invitation then 'pending'::public.cebu_provisioning_state
         else 'ready'::public.cebu_provisioning_state end
  );
  return new;
end;
$$;
revoke all on function cebu_private.handle_new_auth_user() from public, anon, authenticated;
create trigger cebu_after_auth_user_created after insert on auth.users
  for each row execute function cebu_private.handle_new_auth_user();

-- Deferred constraint checks final transaction state, allowing atomic transfer.
create function cebu_private.check_officer_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.account_access a
    where a.product_role = 'officer' and a.enabled and a.provisioning_state = 'ready'
      and not exists (
        select 1 from public.officer_assignments oa
        join public.barangays b on b.id = oa.barangay_id
        where oa.officer_id = a.user_id and oa.effective_to is null and b.enabled
      )
  ) then
    raise exception using errcode = '23514', message = 'Active officer requires a current enabled barangay assignment';
  end if;
  if exists (
    select 1 from public.officer_assignments oa
    join public.account_access a on a.user_id = oa.officer_id
    where oa.effective_to is null and a.product_role <> 'officer'
  ) then
    raise exception using errcode = '23514', message = 'Current assignments require an officer role';
  end if;
  return null;
end;
$$;
revoke all on function cebu_private.check_officer_assignment() from public, anon, authenticated;
create constraint trigger cebu_access_assignment_invariant
  after insert or update or delete on public.account_access
  deferrable initially deferred for each row execute function cebu_private.check_officer_assignment();
create constraint trigger cebu_assignment_invariant
  after insert or update or delete on public.officer_assignments
  deferrable initially deferred for each row execute function cebu_private.check_officer_assignment();
create constraint trigger cebu_barangay_assignment_invariant
  after insert or update or delete on public.barangays
  deferrable initially deferred for each row execute function cebu_private.check_officer_assignment();

create function public.get_current_access()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result jsonb;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select jsonb_build_object(
    'user_id', a.user_id, 'product_role', a.product_role,
    'enabled', a.enabled, 'provisioning_state', a.provisioning_state,
    'access_version', a.access_version,
    'email_verified', u.email_confirmed_at is not null,
    'eligible', cebu_private.is_eligible(),
    'assigned_barangay_id', (
      select oa.barangay_id from public.officer_assignments oa
      where oa.officer_id = actor and oa.effective_to is null
    )
  ) into result
  from public.account_access a join auth.users u on u.id = a.user_id
  where a.user_id = actor;
  return coalesce(result, jsonb_build_object('user_id', actor, 'eligible', false, 'state', 'missing_access'));
end;
$$;
revoke all on function public.get_current_access() from public, anon, authenticated;
grant execute on function public.get_current_access() to authenticated;

-- Narrow setter: there is no user_id, role or activation argument to spoof.
-- Same desired state is a safe retry; conflicting stale content is rejected.
create function public.update_own_profile(
  p_display_name text,
  p_resident_barangay_id uuid,
  p_expected_version bigint
)
returns public.profiles language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role public.cebu_role;
  current_profile public.profiles;
  clean_name text := btrim(p_display_name);
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  -- Serialize this mutation with future access revocation/assignment commands.
  select a.product_role into actor_role from public.account_access a
    where a.user_id = actor for share;
  if not cebu_private.is_eligible() then
    raise exception using errcode = '42501', message = 'Eligible account required';
  end if;
  if clean_name is null or char_length(clean_name) not between 2 and 80
    or p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'Invalid profile input';
  end if;
  select p.* into current_profile from public.profiles p where p.user_id = actor for update;
  if not found then
    raise exception using errcode = '42501', message = 'Profile unavailable';
  end if;
  if actor_role <> 'resident'
     and p_resident_barangay_id is distinct from current_profile.resident_barangay_id then
    raise exception using errcode = '42501', message = 'Resident community cannot be changed for this role';
  end if;
  if p_resident_barangay_id is not null then
    perform 1 from public.barangays b where b.id = p_resident_barangay_id and b.enabled for share;
    if not found then
      raise exception using errcode = '22023', message = 'Choose an enabled barangay';
    end if;
  end if;
  if current_profile.display_name = clean_name
    and current_profile.resident_barangay_id is not distinct from p_resident_barangay_id then
    return current_profile;
  end if;
  if current_profile.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Profile changed; refresh before saving';
  end if;
  update public.profiles p set display_name = clean_name,
    resident_barangay_id = p_resident_barangay_id,
    version = p.version + 1, updated_at = clock_timestamp()
    where p.user_id = actor returning p.* into current_profile;
  return current_profile;
end;
$$;
revoke all on function public.update_own_profile(text, uuid, bigint) from public, anon, authenticated;
grant execute on function public.update_own_profile(text, uuid, bigint) to authenticated;

comment on schema cebu_private is 'CebuCleanAI internal helpers; do not add to exposed API schemas';
comment on function public.get_current_access() is 'Own minimal routing state, not an authorization token';
comment on table public.officer_assignments is 'Trusted writes only; audited admin command arrives in a later migration';
