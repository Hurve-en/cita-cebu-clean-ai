-- Source: backend/drizzle/0003_community_access.sql
-- Source SHA256: c0df50cada89b79df0379a4547021718fc4d4e4877322e51dfe214d35b8ccc53
BEGIN;
SET LOCAL search_path = public, pg_catalog;
-- Read access only. Trusted write commands/media submission are separate slices.
revoke all on table public.collection_schedules, public.report_categories,
  public.reports, public.report_events from public, anon, authenticated;
grant select on table public.collection_schedules, public.report_categories,
  public.reports, public.report_events to authenticated;

-- Zero-argument helpers always resolve the caller; no spoofable actor parameter.
-- Existing eligibility checks current verification/activation/provisioning state.
create function cebu_private.current_eligible_role()
returns public.cebu_role language sql stable security definer set search_path = ''
as $$
  select a.product_role from public.account_access a
  where a.user_id = (select auth.uid()) and cebu_private.is_eligible();
$$;
revoke all on function cebu_private.current_eligible_role() from public, anon, authenticated;
grant execute on function cebu_private.current_eligible_role() to authenticated;

create function cebu_private.current_officer_barangay()
returns uuid language sql stable security definer set search_path = ''
as $$
  select oa.barangay_id from public.officer_assignments oa
  where oa.officer_id = (select auth.uid()) and oa.effective_to is null
    and cebu_private.current_eligible_role() = 'officer';
$$;
revoke all on function cebu_private.current_officer_barangay() from public, anon, authenticated;
grant execute on function cebu_private.current_officer_barangay() to authenticated;

create function cebu_private.current_resident_barangay()
returns uuid language sql stable security definer set search_path = ''
as $$
  select p.resident_barangay_id from public.profiles p
  where p.user_id = (select auth.uid()) and cebu_private.current_eligible_role() = 'resident';
$$;
revoke all on function cebu_private.current_resident_barangay() from public, anon, authenticated;
grant execute on function cebu_private.current_resident_barangay() to authenticated;

create policy category_read_enabled on public.report_categories for select to authenticated
  using (enabled and (select cebu_private.is_eligible()));

create policy schedules_read_scoped on public.collection_schedules for select to authenticated
  using (
    (barangay_id = (select cebu_private.current_officer_barangay()))
    or (status = 'published' and (
      ((select cebu_private.current_eligible_role()) = 'resident'
        and barangay_id = (select cebu_private.current_resident_barangay()))
      or (select cebu_private.current_eligible_role()) = 'admin'
    ))
  );

create policy reports_read_scoped on public.reports for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select cebu_private.current_eligible_role()) = 'resident')
    or original_barangay_id = (select cebu_private.current_officer_barangay())
  );

-- The reports subquery intentionally runs with the caller's report RLS.
-- There is no reverse events lookup in the reports policy, so no recursion.
create policy report_events_read_scoped on public.report_events for select to authenticated
  using (
    exists (select 1 from public.reports r where r.id = report_events.report_id)
    and (
      (select cebu_private.current_eligible_role()) = 'officer'
      or (visibility = 'resident' and (select cebu_private.current_eligible_role()) = 'resident')
    )
  );

create function cebu_private.protect_report_identity()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     or new.original_barangay_id is distinct from old.original_barangay_id then
    raise exception using errcode = '23514', message = 'Report ownership and original community are immutable';
  end if;
  return new;
end;
$$;
revoke all on function cebu_private.protect_report_identity() from public, anon, authenticated;
create trigger cebu_report_identity_immutable before update on public.reports
  for each row execute function cebu_private.protect_report_identity();

create function cebu_private.protect_schedule_community()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.barangay_id is distinct from old.barangay_id then
    raise exception using errcode = '23514', message = 'Schedule community is immutable';
  end if;
  return new;
end;
$$;
revoke all on function cebu_private.protect_schedule_community() from public, anon, authenticated;
create trigger cebu_schedule_community_immutable before update on public.collection_schedules
  for each row execute function cebu_private.protect_schedule_community();

comment on table public.report_categories is 'Managed category configuration; no fabricated real categories are seeded';
comment on table public.reports is 'Private shared data; client writes remain closed until trusted submission commands exist';
comment on table public.report_events is 'Public and internal events are filtered at the database boundary; clients cannot mutate activity';
comment on table public.collection_schedules is 'Weekly ISO weekdays, ascending and unique; all recurring windows use Asia/Manila';
COMMIT;
