-- DEVELOPMENT ONLY. Execute as postgres after the migration.
-- Synthetic auth rows never send emails and are removed by the final ROLLBACK.
-- Stop on the first SQL error; do not remove the transaction or final rollback.
begin;

create function pg_temp.assert_true(ok boolean, label text)
returns void language plpgsql security invoker as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function pg_temp.expect_error(statement text, expected_code text, label text)
returns void language plpgsql security invoker as $$
declare actual_code text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_code = returned_sqlstate;
  end;
  if actual_code is distinct from expected_code then
    raise exception 'FAIL: %; expected SQLSTATE %, received %', label, expected_code, actual_code;
  end if;
  raise notice 'PASS: %', label;
end;
$$;

insert into public.barangays(id, name, enabled) values
 ('bc000000-0000-4000-8000-000000000001', 'TEST ONLY - North', true),
 ('bc000000-0000-4000-8000-000000000002', 'TEST ONLY - South', true),
 ('bc000000-0000-4000-8000-000000000003', 'TEST ONLY - Disabled', false);

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data) values
 ('bc100000-0000-4000-8000-000000000001', 'cebu-test-a@example.test', now(),
  '{"display_name":"Resident A","role":"admin","product_role":"admin","barangay_id":"forged","cebuclean_provisioning":"officer"}', '{}'),
 ('bc100000-0000-4000-8000-000000000002', 'cebu-test-b@example.test', now(),
  '{"display_name":"Resident B"}', '{}'),
 ('bc100000-0000-4000-8000-000000000003', 'cebu-test-unverified@example.test', null, '{}', '{}'),
 ('bc100000-0000-4000-8000-000000000004', 'cebu-test-disabled@example.test', now(), '{}', '{}'),
 ('bc100000-0000-4000-8000-000000000005', 'cebu-test-pending@example.test', now(), '{}',
  '{"cebuclean_provisioning":"officer"}'),
 ('bc100000-0000-4000-8000-000000000006', 'cebu-test-officer@example.test', now(), '{}',
  '{"cebuclean_provisioning":"officer"}'),
 ('bc100000-0000-4000-8000-000000000007', 'cebu-test-admin@example.test', now(), '{}', '{}');

update public.account_access set enabled = false
 where user_id = 'bc100000-0000-4000-8000-000000000004';
update public.account_access set enabled = true, provisioning_state = 'ready'
 where user_id = 'bc100000-0000-4000-8000-000000000006';
insert into public.officer_assignments(officer_id, barangay_id)
 values ('bc100000-0000-4000-8000-000000000006', 'bc000000-0000-4000-8000-000000000001');
update public.account_access set product_role = 'admin'
 where user_id = 'bc100000-0000-4000-8000-000000000007';
set constraints all immediate;

select pg_temp.assert_true(
 (select product_role = 'resident' from public.account_access
  where user_id = 'bc100000-0000-4000-8000-000000000001'),
 'signup ignores role claims in editable user metadata');
select pg_temp.assert_true(
 (select display_name = 'Resident' from public.profiles
  where user_id = 'bc100000-0000-4000-8000-000000000003'),
 'missing display name safely bootstraps instead of breaking signup');

set local role anon;
select pg_temp.expect_error('select * from public.profiles', '42501', 'anonymous profile read denied');
select pg_temp.expect_error('select public.get_current_access()', '42501', 'anonymous routing RPC denied');
reset role;

select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select pg_temp.expect_error('select public.get_current_access()', '42501', 'authenticated transport role without user identity is denied');
select pg_temp.assert_true((select count(*) = 0 from public.profiles), 'missing user identity does not reveal profiles');
reset role;

select set_config('request.jwt.claims', '{"sub":"bc100000-0000-4000-8000-000000000001","role":"authenticated","product_role":"admin"}', true);
select set_config('request.jwt.claim.sub', 'bc100000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 1 from public.profiles), 'resident reads exactly their own profile');
select pg_temp.assert_true((select count(*) = 0 from public.profiles where user_id = 'bc100000-0000-4000-8000-000000000002'), 'foreign profile remains hidden');
select pg_temp.assert_true((select count(*) = 1 from public.account_access), 'role state is visible only to its owner');
select pg_temp.assert_true((select count(*) = 2 from public.barangays), 'eligible resident sees enabled communities only');
select pg_temp.assert_true(public.get_current_access()->>'product_role' = 'resident', 'forged JWT role does not override current database role');
select pg_temp.expect_error($q$update public.account_access set product_role = 'admin'$q$, '42501', 'client cannot self-promote');
select pg_temp.expect_error($q$update public.profiles set display_name = 'Other'$q$, '42501', 'direct profile writes denied even for owner');
select pg_temp.expect_error($q$insert into public.barangays(name) values ('Forged')$q$, '42501', 'client cannot add managed community');
select pg_temp.expect_error($q$insert into public.officer_assignments(officer_id,barangay_id) values ('bc100000-0000-4000-8000-000000000001','bc000000-0000-4000-8000-000000000001')$q$, '42501', 'client cannot self-assign officer scope');

select pg_temp.assert_true(
 (public.update_own_profile('  Updated Resident A  ', 'bc000000-0000-4000-8000-000000000001', 1)).version = 2,
 'profile RPC trims input and advances version');
select pg_temp.assert_true(
 (public.update_own_profile('Updated Resident A', 'bc000000-0000-4000-8000-000000000001', 1)).version = 2,
 'same desired profile state is a safe retry without another version');
select pg_temp.expect_error($q$select public.update_own_profile('Stale different name', null, 1)$q$, '40001', 'stale changed profile rejected');
select pg_temp.expect_error($q$select public.update_own_profile('A', null, 2)$q$, '22023', 'short display name rejected');
select pg_temp.expect_error($q$select public.update_own_profile('Valid name', 'bc000000-0000-4000-8000-000000000003', 2)$q$, '22023', 'disabled community selection rejected');
select pg_temp.expect_error($q$select public.update_own_profile('Valid name', 'bc000000-0000-4000-8000-000000000099', 2)$q$, '22023', 'unknown community selection rejected');
reset role;
select pg_temp.assert_true((select display_name = 'Resident B' from public.profiles where user_id = 'bc100000-0000-4000-8000-000000000002'), 'own setter never mutates another account');

select set_config('request.jwt.claims', '{"sub":"bc100000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'bc100000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.assert_true(public.get_current_access()->>'eligible' = 'false', 'unverified account is ineligible');
select pg_temp.assert_true((select count(*) = 0 from public.profiles), 'unverified account cannot read protected profile');
select pg_temp.expect_error($q$select public.update_own_profile('Valid name', null, 1)$q$, '42501', 'unverified account cannot update profile');
reset role;

select set_config('request.jwt.claims', '{"sub":"bc100000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'bc100000-0000-4000-8000-000000000004', true);
set local role authenticated;
select pg_temp.assert_true(public.get_current_access()->>'eligible' = 'false', 'disabled account routing state is honest');
select pg_temp.assert_true((select count(*) = 0 from public.barangays), 'disabled account cannot read protected community list');
reset role;

select set_config('request.jwt.claims', '{"sub":"bc100000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'bc100000-0000-4000-8000-000000000005', true);
set local role authenticated;
select pg_temp.assert_true(public.get_current_access()->>'provisioning_state' = 'pending', 'trusted officer invitation bootstraps pending');
select pg_temp.assert_true(public.get_current_access()->>'eligible' = 'false', 'pending officer remains ineligible even with verified email');
reset role;

select set_config('request.jwt.claims', '{"sub":"bc100000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'bc100000-0000-4000-8000-000000000006', true);
set local role authenticated;
select pg_temp.assert_true(public.get_current_access()->>'eligible' = 'true', 'ready assigned officer is eligible');
select pg_temp.assert_true((select count(*) = 1 from public.officer_assignments), 'officer reads only own assignment history');
select pg_temp.expect_error($q$select public.update_own_profile('Officer name', 'bc000000-0000-4000-8000-000000000002', 1)$q$, '42501', 'officer profile setter cannot change community scope');
reset role;

select pg_temp.expect_error($q$insert into public.officer_assignments(officer_id,barangay_id) values ('bc100000-0000-4000-8000-000000000006','bc000000-0000-4000-8000-000000000002')$q$, '23505', 'database prevents two current officer assignments');
select pg_temp.expect_error($q$insert into public.officer_assignments(officer_id,barangay_id) values ('bc100000-0000-4000-8000-000000000002','bc000000-0000-4000-8000-000000000002')$q$, '23514', 'database rejects current officer assignment for resident role');
select pg_temp.expect_error($q$update public.account_access set product_role = 'officer' where user_id = 'bc100000-0000-4000-8000-000000000002'$q$, '23514', 'database rejects active officer without assignment');
select pg_temp.expect_error($q$update public.barangays set enabled = false where id = 'bc000000-0000-4000-8000-000000000001'$q$, '23514', 'database protects assignment when disabling a staffed community');

-- Same request claims remain in place: eligibility must change from database state.
update public.account_access set enabled = false, access_version = access_version + 1
 where user_id = 'bc100000-0000-4000-8000-000000000006';
set local role authenticated;
select pg_temp.assert_true(public.get_current_access()->>'eligible' = 'false', 'deactivation affects existing request identity without refreshed claims');
select pg_temp.assert_true((select count(*) = 0 from public.officer_assignments), 'deactivated officer loses protected assignment reads');
reset role;

select set_config('request.jwt.claims', '{"sub":"bc100000-0000-4000-8000-000000000007","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'bc100000-0000-4000-8000-000000000007', true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 1 from public.profiles), 'admin has no implicit foreign-profile read bypass');
select pg_temp.expect_error($q$update public.account_access set enabled = true$q$, '42501', 'admin client also requires future trusted mutation endpoint');
reset role;

rollback;
