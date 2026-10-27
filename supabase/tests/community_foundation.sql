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
 ('cd000000-0000-4000-8000-000000000001', 'TEST ONLY - Community North'),
 ('cd000000-0000-4000-8000-000000000002', 'TEST ONLY - Community South');
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data) values
 ('cd100000-0000-4000-8000-000000000001', 'community-a@example.test', now(), '{"display_name":"Resident A"}', '{}'),
 ('cd100000-0000-4000-8000-000000000002', 'community-b@example.test', now(), '{"display_name":"Resident B"}', '{}'),
 ('cd100000-0000-4000-8000-000000000003', 'community-c@example.test', now(), '{"display_name":"Resident C"}', '{}'),
 ('cd100000-0000-4000-8000-000000000004', 'community-officer-n@example.test', now(), '{}', '{"cebuclean_provisioning":"officer"}'),
 ('cd100000-0000-4000-8000-000000000005', 'community-officer-s@example.test', now(), '{}', '{"cebuclean_provisioning":"officer"}'),
 ('cd100000-0000-4000-8000-000000000006', 'community-admin@example.test', now(), '{}', '{}'),
 ('cd100000-0000-4000-8000-000000000007', 'community-unverified@example.test', null, '{}', '{}'),
 ('cd100000-0000-4000-8000-000000000008', 'community-disabled@example.test', now(), '{}', '{}');
update public.profiles set resident_barangay_id = 'cd000000-0000-4000-8000-000000000001'
 where user_id in ('cd100000-0000-4000-8000-000000000001','cd100000-0000-4000-8000-000000000002',
 'cd100000-0000-4000-8000-000000000007','cd100000-0000-4000-8000-000000000008');
update public.profiles set resident_barangay_id = 'cd000000-0000-4000-8000-000000000002'
 where user_id = 'cd100000-0000-4000-8000-000000000003';
update public.account_access set enabled = true, provisioning_state = 'ready'
 where user_id in ('cd100000-0000-4000-8000-000000000004','cd100000-0000-4000-8000-000000000005');
insert into public.officer_assignments(officer_id, barangay_id) values
 ('cd100000-0000-4000-8000-000000000004', 'cd000000-0000-4000-8000-000000000001'),
 ('cd100000-0000-4000-8000-000000000005', 'cd000000-0000-4000-8000-000000000002');
update public.account_access set product_role = 'admin' where user_id = 'cd100000-0000-4000-8000-000000000006';
update public.account_access set enabled = false where user_id = 'cd100000-0000-4000-8000-000000000008';
set constraints all immediate;

insert into public.report_categories(code, label, enabled) values
 ('test_dumping', 'TEST ONLY - Dumping concern', true),
 ('test_collection', 'TEST ONLY - Collection concern', true),
 ('test_disabled', 'TEST ONLY - Disabled category', false);

insert into public.collection_schedules(id, barangay_id, title, stream, weekdays, start_time, end_time, area, status, created_by, updated_by) values
 ('cd200000-0000-4000-8000-000000000001', 'cd000000-0000-4000-8000-000000000001', 'North published', 'recyclables', array[1,4], '08:00','11:00','North area','published','cd100000-0000-4000-8000-000000000004','cd100000-0000-4000-8000-000000000004'),
 ('cd200000-0000-4000-8000-000000000002', 'cd000000-0000-4000-8000-000000000001', 'North draft', 'organic', array[2], '07:00','09:00','North area','draft','cd100000-0000-4000-8000-000000000004','cd100000-0000-4000-8000-000000000004'),
 ('cd200000-0000-4000-8000-000000000003', 'cd000000-0000-4000-8000-000000000001', 'North archive', 'residual', array[3], '08:00','10:00','North area','archived','cd100000-0000-4000-8000-000000000004','cd100000-0000-4000-8000-000000000004'),
 ('cd200000-0000-4000-8000-000000000004', 'cd000000-0000-4000-8000-000000000002', 'South published', 'residual', array[5], '08:00','10:00','South area','published','cd100000-0000-4000-8000-000000000005','cd100000-0000-4000-8000-000000000005');

insert into public.reports(id, owner_id, original_barangay_id, title, category_code, location_text, description, status) values
 ('cd300000-0000-4000-8000-000000000001','cd100000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000001','Resident A concern','test_dumping','North street','Synthetic report for resident A.','in_progress'),
 ('cd300000-0000-4000-8000-000000000002','cd100000-0000-4000-8000-000000000002','cd000000-0000-4000-8000-000000000001','Resident B concern','test_dumping','North street','Synthetic report for resident B.','pending_review'),
 ('cd300000-0000-4000-8000-000000000003','cd100000-0000-4000-8000-000000000003','cd000000-0000-4000-8000-000000000002','Resident C concern','test_collection','South street','Synthetic report for resident C.','pending_review');

insert into public.report_events(id, report_id, actor_id, event_type, previous_status, next_status, visibility, note) values
 ('cd400000-0000-4000-8000-000000000001','cd300000-0000-4000-8000-000000000001','cd100000-0000-4000-8000-000000000001','created',null,'pending_review','resident','Report submitted'),
 ('cd400000-0000-4000-8000-000000000002','cd300000-0000-4000-8000-000000000001','cd100000-0000-4000-8000-000000000004','status_changed','pending_review','in_progress','resident','Review started'),
 ('cd400000-0000-4000-8000-000000000003','cd300000-0000-4000-8000-000000000001','cd100000-0000-4000-8000-000000000004','internal_note',null,null,'internal','PRIVATE_OFFICER_NOTE'),
 ('cd400000-0000-4000-8000-000000000004','cd300000-0000-4000-8000-000000000002','cd100000-0000-4000-8000-000000000002','created',null,'pending_review','resident','Report submitted'),
 ('cd400000-0000-4000-8000-000000000005','cd300000-0000-4000-8000-000000000003','cd100000-0000-4000-8000-000000000003','created',null,'pending_review','resident','Report submitted');

set local role anon;
select pg_temp.expect_error('select * from public.reports','42501','anonymous reports denied');
select pg_temp.expect_error('select * from public.report_events','42501','anonymous events denied');
select pg_temp.expect_error('select * from public.collection_schedules','42501','anonymous schedules denied');
select pg_temp.expect_error('select * from public.report_categories','42501','anonymous category list denied');
reset role;

select set_config('request.jwt.claim.sub','cd100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"cd100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.reports),'resident sees exactly own report');
select pg_temp.assert_true((select count(*)=0 from public.reports where id='cd300000-0000-4000-8000-000000000002'),'same-community foreign report hidden');
select pg_temp.assert_true((select count(*)=0 from public.reports where id='cd300000-0000-4000-8000-000000000003'),'foreign-community report hidden');
select pg_temp.assert_true((select count(*)=2 from public.report_events),'resident sees only own public activity');
select pg_temp.assert_true((select count(*)=0 from public.report_events where visibility='internal'),'internal notes excluded from resident SQL results');
select pg_temp.assert_true((select count(*)=0 from public.report_events where note like '%PRIVATE_OFFICER_NOTE%'),'internal content cannot leak through filtered search');
select pg_temp.assert_true((select count(*)=1 from public.collection_schedules),'resident sees only one published community schedule');
select pg_temp.assert_true((select count(*)=0 from public.collection_schedules where status<>'published'),'resident cannot discover drafts or archives');
select pg_temp.assert_true((select count(*)=0 from public.collection_schedules where barangay_id='cd000000-0000-4000-8000-000000000002'),'resident cannot discover foreign schedules');
select pg_temp.assert_true((select count(*)=2 from public.report_categories),'only enabled category options are visible');
select pg_temp.expect_error($q$insert into public.reports(owner_id,original_barangay_id,title,category_code,location_text,description) values ('cd100000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000001','Direct report','test_dumping','North street','A valid but unauthorized direct write.')$q$,'42501','direct report creation remains closed');
select pg_temp.expect_error($q$update public.reports set status='resolved' where id='cd300000-0000-4000-8000-000000000001'$q$,'42501','resident cannot change report status');
select pg_temp.expect_error('delete from public.reports','42501','resident cannot directly delete reports');
select pg_temp.expect_error($q$update public.report_events set note='Forged activity'$q$,'42501','resident cannot modify report history');
select pg_temp.expect_error($q$update public.collection_schedules set status='published'$q$,'42501','resident cannot publish schedules');
select pg_temp.expect_error($q$update public.report_categories set enabled=true$q$,'42501','resident cannot manage category options');
select public.update_own_profile('Resident A','cd000000-0000-4000-8000-000000000002',1);
select pg_temp.assert_true((select count(*)=1 from public.collection_schedules where barangay_id='cd000000-0000-4000-8000-000000000002'),'community change updates schedule visibility');
select pg_temp.assert_true((select count(*)=1 from public.reports where original_barangay_id='cd000000-0000-4000-8000-000000000001'),'community change preserves owned historical report access');
reset role;

select set_config('request.jwt.claim.sub','cd100000-0000-4000-8000-000000000007',true);
select set_config('request.jwt.claims','{"sub":"cd100000-0000-4000-8000-000000000007","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.reports),'unverified resident sees no reports');
select pg_temp.assert_true((select count(*)=0 from public.report_events),'unverified resident sees no events');
select pg_temp.assert_true((select count(*)=0 from public.collection_schedules),'unverified resident sees no schedules');
select pg_temp.assert_true((select count(*)=0 from public.report_categories),'unverified resident sees no category list');
reset role;

select set_config('request.jwt.claim.sub','cd100000-0000-4000-8000-000000000008',true);
select set_config('request.jwt.claims','{"sub":"cd100000-0000-4000-8000-000000000008","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.reports),'disabled resident sees no reports');
select pg_temp.assert_true((select count(*)=0 from public.collection_schedules),'disabled resident sees no schedules');
reset role;

select set_config('request.jwt.claim.sub','cd100000-0000-4000-8000-000000000006',true);
select set_config('request.jwt.claims','{"sub":"cd100000-0000-4000-8000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.reports),'admin has no implicit private report access');
select pg_temp.assert_true((select count(*)=0 from public.report_events),'admin has no implicit private or public report activity access');
select pg_temp.assert_true((select count(*)=2 from public.collection_schedules),'admin sees published oversight across communities only');
select pg_temp.assert_true((select count(*)=0 from public.collection_schedules where status<>'published'),'admin cannot read draft or archived schedules');
select pg_temp.expect_error($q$update public.collection_schedules set status='archived'$q$,'42501','admin cannot bypass schedule write boundary');
reset role;

select set_config('request.jwt.claim.sub','cd100000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"cd100000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=2 from public.reports),'officer reads reports from assigned community');
select pg_temp.assert_true((select count(*)=4 from public.report_events),'officer reads public and internal assigned events');
select pg_temp.assert_true((select count(*)=1 from public.report_events where visibility='internal'),'assigned internal note is visible to officer');
select pg_temp.assert_true((select count(*)=0 from public.reports where original_barangay_id='cd000000-0000-4000-8000-000000000002'),'foreign reports remain hidden from officer');
select pg_temp.assert_true((select count(*)=3 from public.collection_schedules),'officer sees all schedule states in assignment');
select pg_temp.expect_error($q$update public.reports set status='resolved'$q$,'42501','officer must use future workflow command rather than direct update');
select pg_temp.expect_error('delete from public.report_events','42501','officer cannot erase activity');
reset role;

-- Test reassignment with unchanged request claims and preserved historical data.
set constraints all deferred;
update public.officer_assignments set effective_to=now()
 where officer_id='cd100000-0000-4000-8000-000000000004' and effective_to is null;
insert into public.officer_assignments(officer_id,barangay_id)
 values('cd100000-0000-4000-8000-000000000004','cd000000-0000-4000-8000-000000000002');
set constraints all immediate;
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.reports),'reassigned officer sees new community using existing identity');
select pg_temp.assert_true((select count(*)=0 from public.reports where id='cd300000-0000-4000-8000-000000000001'),'old assigned report access is removed');
select pg_temp.assert_true((select count(*)=1 from public.report_events),'old internal notes disappear after reassignment');
select pg_temp.assert_true((select count(*)=1 from public.collection_schedules),'new assignment changes schedule scope');
reset role;
select pg_temp.assert_true((select count(*)=2 from public.reports where original_barangay_id='cd000000-0000-4000-8000-000000000001'),'reassignment does not move community reports');
update public.account_access set enabled=false, access_version=access_version+1
 where user_id='cd100000-0000-4000-8000-000000000004';
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.reports),'deactivated officer loses report access');
select pg_temp.assert_true((select count(*)=0 from public.report_events),'deactivated officer loses internal activity access');
select pg_temp.assert_true((select count(*)=0 from public.collection_schedules),'deactivated officer loses schedule access');
reset role;

-- Operator constraint tests: each expected error rolls its attempted change back.
select pg_temp.expect_error($q$update public.collection_schedules set weekdays=array[]::integer[] where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','empty weekday set rejected');
select pg_temp.expect_error($q$update public.collection_schedules set weekdays=array[1,1] where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','duplicate weekdays rejected');
select pg_temp.expect_error($q$update public.collection_schedules set weekdays=array[4,1] where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','noncanonical weekday order rejected');
select pg_temp.expect_error($q$update public.collection_schedules set weekdays=array[0] where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','weekday zero rejected');
select pg_temp.expect_error($q$update public.collection_schedules set weekdays=array[8] where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','weekday above seven rejected');
select pg_temp.expect_error($q$update public.collection_schedules set weekdays=array[1,null] where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','null weekday rejected');
select pg_temp.expect_error($q$update public.collection_schedules set start_time='12:00',end_time='08:00' where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','overnight or reversed window rejected');
select pg_temp.expect_error($q$update public.collection_schedules set end_time=start_time where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','zero duration rejected');
select pg_temp.expect_error($q$update public.collection_schedules set end_time='24:00' where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','24 hour boundary rejected');
select pg_temp.expect_error($q$update public.collection_schedules set start_time='08:00:30' where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','seconds outside minute precision rejected');
select pg_temp.expect_error($q$update public.collection_schedules set timezone='UTC' where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','schedule recurrence timezone is fixed');
select pg_temp.expect_error($q$update public.collection_schedules set instructions=repeat('x',1001) where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','oversized schedule instructions rejected');
select pg_temp.expect_error($q$update public.collection_schedules set barangay_id='cd000000-0000-4000-8000-000000000002' where id='cd200000-0000-4000-8000-000000000001'$q$,'23514','schedule community cannot be moved');
select pg_temp.expect_error($q$update public.reports set title='xx' where id='cd300000-0000-4000-8000-000000000001'$q$,'23514','short report title rejected');
select pg_temp.expect_error($q$update public.reports set location_text='xx' where id='cd300000-0000-4000-8000-000000000001'$q$,'23514','short report location rejected');
select pg_temp.expect_error($q$update public.reports set description='short' where id='cd300000-0000-4000-8000-000000000001'$q$,'23514','short report description rejected');
select pg_temp.expect_error($q$update public.reports set category_code='not_configured' where id='cd300000-0000-4000-8000-000000000001'$q$,'23503','unconfigured report category rejected');
select pg_temp.expect_error($q$update public.reports set version=0 where id='cd300000-0000-4000-8000-000000000001'$q$,'23514','invalid version rejected');
select pg_temp.expect_error($q$update public.reports set owner_id='cd100000-0000-4000-8000-000000000002' where id='cd300000-0000-4000-8000-000000000001'$q$,'23514','report owner is immutable');
select pg_temp.expect_error($q$update public.reports set original_barangay_id='cd000000-0000-4000-8000-000000000002' where id='cd300000-0000-4000-8000-000000000001'$q$,'23514','report original community is immutable');
select pg_temp.expect_error($q$update public.report_events set note='' where id='cd400000-0000-4000-8000-000000000003'$q$,'23514','empty internal note rejected');
select pg_temp.expect_error($q$update public.report_events set visibility='resident' where id='cd400000-0000-4000-8000-000000000003'$q$,'23514','internal note cannot be relabeled public');
select pg_temp.expect_error($q$update public.report_events set next_status=previous_status where id='cd400000-0000-4000-8000-000000000002'$q$,'23514','invalid status event transition rejected');
select pg_temp.expect_error($q$update public.report_events set next_status='resolved',note='done' where id='cd400000-0000-4000-8000-000000000002'$q$,'23514','resolution event requires explanation');
select pg_temp.expect_error($q$update public.report_events set previous_status=null where id='cd400000-0000-4000-8000-000000000002'$q$,'23514','status event cannot omit old status');
select pg_temp.expect_error($q$update public.report_events set next_status=null where id='cd400000-0000-4000-8000-000000000001'$q$,'23514','created event requires initial status');

select 'Community foundation assertions completed; transaction will roll back.' as test_result;
rollback;
