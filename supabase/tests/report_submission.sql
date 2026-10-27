-- DEVELOPMENT ONLY: execute the COMPLETE file as postgres, never fragments.
-- Synthetic accounts/data are created within this transaction and rolled back.
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
  begin execute statement;
  exception when others then get stacked diagnostics actual_code = returned_sqlstate;
  end;
  if actual_code is distinct from expected_code then
    raise exception 'FAIL: %; expected %, received %', label, expected_code, actual_code;
  end if;
  raise notice 'PASS: %', label;
end;
$$;

insert into public.barangays(id, name) values
 ('ce000000-0000-4000-8000-000000000001', 'TEST ONLY - Community North'),
 ('ce000000-0000-4000-8000-000000000002', 'TEST ONLY - Community South');
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data) values
 ('ce100000-0000-4000-8000-000000000001', 'community-a@example.test', now(), '{"display_name":"Resident A"}', '{}'),
 ('ce100000-0000-4000-8000-000000000002', 'community-b@example.test', now(), '{"display_name":"Resident B"}', '{}'),
 ('ce100000-0000-4000-8000-000000000003', 'community-c@example.test', now(), '{"display_name":"Resident C"}', '{}'),
 ('ce100000-0000-4000-8000-000000000004', 'community-officer-n@example.test', now(), '{}', '{"cebuclean_provisioning":"officer"}'),
 ('ce100000-0000-4000-8000-000000000005', 'community-officer-s@example.test', now(), '{}', '{"cebuclean_provisioning":"officer"}'),
 ('ce100000-0000-4000-8000-000000000006', 'community-admin@example.test', now(), '{}', '{}'),
 ('ce100000-0000-4000-8000-000000000007', 'community-unverified@example.test', null, '{}', '{}'),
 ('ce100000-0000-4000-8000-000000000008', 'community-disabled@example.test', now(), '{}', '{}');
update public.profiles set resident_barangay_id = 'ce000000-0000-4000-8000-000000000001'
 where user_id in ('ce100000-0000-4000-8000-000000000001','ce100000-0000-4000-8000-000000000002',
 'ce100000-0000-4000-8000-000000000007','ce100000-0000-4000-8000-000000000008');
update public.profiles set resident_barangay_id = 'ce000000-0000-4000-8000-000000000002'
 where user_id = 'ce100000-0000-4000-8000-000000000003';
update public.account_access set enabled = true, provisioning_state = 'ready'
 where user_id in ('ce100000-0000-4000-8000-000000000004','ce100000-0000-4000-8000-000000000005');
insert into public.officer_assignments(officer_id, barangay_id) values
 ('ce100000-0000-4000-8000-000000000004', 'ce000000-0000-4000-8000-000000000001'),
 ('ce100000-0000-4000-8000-000000000005', 'ce000000-0000-4000-8000-000000000002');
update public.account_access set product_role = 'admin' where user_id = 'ce100000-0000-4000-8000-000000000006';
update public.account_access set enabled = false where user_id = 'ce100000-0000-4000-8000-000000000008';
set constraints all immediate;

insert into public.report_categories(code, label, enabled) values
 ('test_dumping', 'TEST ONLY - Dumping concern', true),
 ('test_collection', 'TEST ONLY - Collection concern', true),
 ('test_disabled', 'TEST ONLY - Disabled category', false);

create temporary table submission_results(label text primary key, value jsonb);
grant select,insert on submission_results to authenticated;
set local role anon;
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000001','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street','Report description for resident A.')$q$,'42501','anonymous RPC denied');
select pg_temp.expect_error('select * from public.report_submission_receipts','42501','anonymous receipts denied');
reset role;
select set_config('request.jwt.claim.sub','ce100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"ce100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into submission_results values ('first',public.submit_resident_report('ce500000-0000-4000-8000-000000000001','ce000000-0000-4000-8000-000000000001',E'  Waste\t concern  ','test_dumping',E' North\nstreet ',E'\t Report description for resident A. \r\n'));
select pg_temp.assert_true((select (value->>'replayed')::boolean=false from submission_results where label='first'),'new submission is confirmed rather than replayed');
select pg_temp.assert_true((select value->'report'->>'owner_id'='ce100000-0000-4000-8000-000000000001' from submission_results where label='first'),'owner comes from authenticated identity');
select pg_temp.assert_true((select value->'report'->>'original_barangay_id'='ce000000-0000-4000-8000-000000000001' from submission_results where label='first'),'community comes from selected profile');
select pg_temp.assert_true((select value->'report'->>'status'='pending_review' from submission_results where label='first'),'initial status is server controlled');
select pg_temp.assert_true((select title='Waste concern' and location_text='North street' and description='Report description for resident A.' from public.reports),'text normalization is consistent');
select pg_temp.assert_true((select count(*)=1 from public.reports),'one report committed');
select pg_temp.assert_true((select count(*)=1 from public.report_events where event_type='created' and actor_id=auth.uid() and visibility='resident' and next_status='pending_review'),'one attributed initial event committed');
select pg_temp.expect_error('select * from public.report_submission_receipts','42501','resident cannot read receipt payloads');
select pg_temp.expect_error('delete from public.report_submission_receipts','42501','resident cannot delete retry receipts');
select pg_temp.expect_error($q$update public.reports set status='resolved'$q$,'42501','direct report status updates stay closed');
select pg_temp.expect_error('delete from public.report_events','42501','activity deletion stays closed');
insert into submission_results values ('retry',public.submit_resident_report('ce500000-0000-4000-8000-000000000001','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street','Report description for resident A.'));
select pg_temp.assert_true((select (value->>'replayed')::boolean from submission_results where label='retry'),'same payload and key are replayed');
select pg_temp.assert_true((select value->'report'->>'id' from submission_results where label='retry')=(select value->'report'->>'id' from submission_results where label='first'),'retry returns original report ID');
select pg_temp.assert_true((select count(*)=1 from public.reports) and (select count(*)=1 from public.report_events),'retry does not duplicate report or initial activity');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000001','ce000000-0000-4000-8000-000000000001','Different title','test_dumping','North street','Report description for resident A.')$q$,'23505','changed payload cannot reuse a committed key');
select pg_temp.expect_error($q$select public.submit_resident_report(null,'ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street','Valid report description.')$q$,'22023','null key rejected');
select pg_temp.expect_error($q$select public.submit_resident_report('00000000-0000-0000-0000-000000000000','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street','Valid report description.')$q$,'22023','nil key rejected');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000002',null,'Waste concern','test_dumping','North street','Valid report description.')$q$,'22023','missing community rejected');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000002','ce000000-0000-4000-8000-000000000001',null,'test_dumping','North street','Valid report description.')$q$,'22023','null title rejected');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000002','ce000000-0000-4000-8000-000000000001','xx','test_dumping','North street','Valid report description.')$q$,'22023','short title rejected');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000002','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','xx','Valid report description.')$q$,'22023','short location rejected');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000002','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street',repeat(' ',30))$q$,'22023','blank description rejected');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000002','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street',repeat('x',2001))$q$,'22023','oversized description rejected');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000002','ce000000-0000-4000-8000-000000000001','Waste concern','not_configured','North street','Valid report description.')$q$,'22023','unconfigured category rejected');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000002','ce000000-0000-4000-8000-000000000001','Waste concern','test_disabled','North street','Valid report description.')$q$,'22023','disabled category rejected');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000002','ce000000-0000-4000-8000-000000000002','Waste concern','test_dumping','South street','Valid report description.')$q$,'22023','foreign selected community cannot be supplied');
select public.update_own_profile('Resident A',null,1);
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000002','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street','Valid report description.')$q$,'22023','resident without selected community cannot submit');
select public.update_own_profile('Resident A','ce000000-0000-4000-8000-000000000001',2);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.report_submission_receipts),'rejected calls do not create receipts');
select pg_temp.assert_true((select count(*)=1 from public.reports) and (select count(*)=1 from public.report_events),'rejected calls create neither reports nor events');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.report_submission_receipts'::regclass),'receipt table enables RLS');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.report_submission_receipts','INSERT') and not has_table_privilege('authenticated','public.report_submission_receipts','UPDATE'),'receipt mutation privileges stay closed');
select pg_temp.assert_true(not has_function_privilege('anon','public.submit_resident_report(uuid,uuid,text,text,text,text)','EXECUTE') and has_function_privilege('authenticated','public.submit_resident_report(uuid,uuid,text,text,text,text)','EXECUTE'),'only signed-in clients receive RPC execution');

select set_config('request.jwt.claim.sub','ce100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"ce100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into submission_results values ('other_owner',public.submit_resident_report('ce500000-0000-4000-8000-000000000001','ce000000-0000-4000-8000-000000000001','Resident B report','test_dumping','North street','Valid report for resident B.'));
select pg_temp.assert_true((select value->'report'->>'id' from submission_results where label='other_owner')<>(select value->'report'->>'id' from submission_results where label='first'),'request keys are scoped per owner');
select pg_temp.assert_true((select count(*)=1 from public.reports),'second resident sees only their report');
select pg_temp.assert_true((select count(*)=0 from public.reports where id=(select (value->'report'->>'id')::uuid from submission_results where label='first')),'first resident report stays private');
reset role;
select set_config('request.jwt.claim.sub','ce100000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"ce100000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000003','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street','Valid report description.')$q$,'42501','officer cannot submit as a resident');
reset role;
select set_config('request.jwt.claim.sub','ce100000-0000-4000-8000-000000000006',true);
select set_config('request.jwt.claims','{"sub":"ce100000-0000-4000-8000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000003','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street','Valid report description.')$q$,'42501','admin cannot submit as a resident');
reset role;
select set_config('request.jwt.claim.sub','ce100000-0000-4000-8000-000000000007',true);
select set_config('request.jwt.claims','{"sub":"ce100000-0000-4000-8000-000000000007","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000003','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street','Valid report description.')$q$,'42501','unverified resident cannot submit as a resident');
reset role;
select set_config('request.jwt.claim.sub','ce100000-0000-4000-8000-000000000008',true);
select set_config('request.jwt.claims','{"sub":"ce100000-0000-4000-8000-000000000008","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000003','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street','Valid report description.')$q$,'42501','disabled resident cannot submit as a resident');
reset role;
select set_config('request.jwt.claim.sub','ce100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"ce100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.update_own_profile('Resident A','ce000000-0000-4000-8000-000000000002',3);
reset role;
update public.report_categories set enabled=false where code='test_dumping';
set local role authenticated;
insert into submission_results values ('after_change',public.submit_resident_report('ce500000-0000-4000-8000-000000000001','ce000000-0000-4000-8000-000000000001','Waste concern','test_dumping','North street','Report description for resident A.'));
select pg_temp.assert_true((select (value->>'replayed')::boolean from submission_results where label='after_change'),'committed retry remains valid after community and category changes');
select pg_temp.assert_true((select count(*)=1 from public.reports where original_barangay_id='ce000000-0000-4000-8000-000000000001'),'historical report stays in original community');
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000004','ce000000-0000-4000-8000-000000000002','Waste concern','test_dumping','South street','Valid report description.')$q$,'22023','new write does not bypass disabled category');
reset role;
update public.report_categories set enabled=true where code='test_dumping';
create function pg_temp.fail_report_event() returns trigger language plpgsql as $$
begin
  if current_setting('cebu_test.fail_report_event',true)='yes' then
    raise exception using errcode='P0001',message='Synthetic event failure';
  end if;
  return new;
end;
$$;
create trigger test_only_event_failure before insert on public.report_events
  for each row execute function pg_temp.fail_report_event();
select set_config('cebu_test.fail_report_event','yes',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000020','ce000000-0000-4000-8000-000000000002','Another concern','test_dumping','South street','Valid report description.')$q$,'P0001','initial event failure aborts submission');
reset role;
select pg_temp.assert_true((select count(*)=2 from public.reports) and (select count(*)=2 from public.report_events) and (select count(*)=2 from public.report_submission_receipts),'event failure rolls report and receipt back atomically');
select set_config('cebu_test.fail_report_event','no',true);
set local role authenticated;
insert into submission_results values ('after_failure',public.submit_resident_report('ce500000-0000-4000-8000-000000000020','ce000000-0000-4000-8000-000000000002','Another concern','test_dumping','South street','Valid report description.'));
select pg_temp.assert_true((select (value->>'replayed')::boolean=false from submission_results where label='after_failure'),'failed transaction leaves key available for a safe retry');
select pg_temp.assert_true((select count(*)=2 from public.reports),'resident now has exactly two reports');
reset role;
update public.account_access set enabled=false where user_id='ce100000-0000-4000-8000-000000000005';
update public.barangays set enabled=false where id='ce000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000021','ce000000-0000-4000-8000-000000000002','Another concern','test_dumping','South street','Valid report description.')$q$,'22023','new reports require an enabled community');
select pg_temp.assert_true((public.submit_resident_report('ce500000-0000-4000-8000-000000000020','ce000000-0000-4000-8000-000000000002','Another concern','test_dumping','South street','Valid report description.')->>'replayed')::boolean,'committed receipt can be confirmed after community is disabled');
reset role;
update public.account_access set enabled=false where user_id='ce100000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000020','ce000000-0000-4000-8000-000000000002','Another concern','test_dumping','South street','Valid report description.')$q$,'42501','disabled identity cannot use receipt replay to bypass access');
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.submit_resident_report('ce500000-0000-4000-8000-000000000025','ce000000-0000-4000-8000-000000000002','Another concern','test_dumping','South street','Valid report description.')$q$,'42501','authenticated SQL role without an identity cannot submit');
reset role;
select 'Resident report submission assertions completed; transaction will roll back.' as test_result;
rollback;
