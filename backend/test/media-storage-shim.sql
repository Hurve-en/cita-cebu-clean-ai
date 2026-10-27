-- LOCAL PGLITE STORAGE METADATA SHIM ONLY. NEVER RUN ON SUPABASE.
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
 ('cf000000-0000-4000-8000-000000000001', 'TEST ONLY - Media North'),
 ('cf000000-0000-4000-8000-000000000002', 'TEST ONLY - Media South');
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data) values
 ('cf100000-0000-4000-8000-000000000001', 'community-a@example.test', now(), '{"display_name":"Resident A"}', '{}'),
 ('cf100000-0000-4000-8000-000000000002', 'community-b@example.test', now(), '{"display_name":"Resident B"}', '{}'),
 ('cf100000-0000-4000-8000-000000000003', 'community-c@example.test', now(), '{"display_name":"Resident C"}', '{}'),
 ('cf100000-0000-4000-8000-000000000004', 'community-officer-n@example.test', now(), '{}', '{"cebuclean_provisioning":"officer"}'),
 ('cf100000-0000-4000-8000-000000000005', 'community-officer-s@example.test', now(), '{}', '{"cebuclean_provisioning":"officer"}'),
 ('cf100000-0000-4000-8000-000000000006', 'community-admin@example.test', now(), '{}', '{}'),
 ('cf100000-0000-4000-8000-000000000007', 'community-unverified@example.test', null, '{}', '{}'),
 ('cf100000-0000-4000-8000-000000000008', 'community-disabled@example.test', now(), '{}', '{}');
update public.profiles set resident_barangay_id = 'cf000000-0000-4000-8000-000000000001'
 where user_id in ('cf100000-0000-4000-8000-000000000001','cf100000-0000-4000-8000-000000000002',
 'cf100000-0000-4000-8000-000000000007','cf100000-0000-4000-8000-000000000008');
update public.profiles set resident_barangay_id = 'cf000000-0000-4000-8000-000000000002'
 where user_id = 'cf100000-0000-4000-8000-000000000003';
update public.account_access set enabled = true, provisioning_state = 'ready'
 where user_id in ('cf100000-0000-4000-8000-000000000004','cf100000-0000-4000-8000-000000000005');
insert into public.officer_assignments(officer_id, barangay_id) values
 ('cf100000-0000-4000-8000-000000000004', 'cf000000-0000-4000-8000-000000000001'),
 ('cf100000-0000-4000-8000-000000000005', 'cf000000-0000-4000-8000-000000000002');
update public.account_access set product_role = 'admin' where user_id = 'cf100000-0000-4000-8000-000000000006';
update public.account_access set enabled = false where user_id = 'cf100000-0000-4000-8000-000000000008';
set constraints all immediate;

insert into public.report_categories(code, label, enabled) values
 ('test_dumping', 'TEST ONLY - Dumping concern', true),
 ('test_collection', 'TEST ONLY - Collection concern', true),
 ('test_disabled', 'TEST ONLY - Disabled category', false);

insert into public.collection_schedules(id, barangay_id, title, stream, weekdays, start_time, end_time, area, status, created_by, updated_by) values
 ('cf200000-0000-4000-8000-000000000001', 'cf000000-0000-4000-8000-000000000001', 'North published', 'recyclables', array[1,4], '08:00','11:00','North area','published','cf100000-0000-4000-8000-000000000004','cf100000-0000-4000-8000-000000000004'),
 ('cf200000-0000-4000-8000-000000000002', 'cf000000-0000-4000-8000-000000000001', 'North draft', 'organic', array[2], '07:00','09:00','North area','draft','cf100000-0000-4000-8000-000000000004','cf100000-0000-4000-8000-000000000004'),
 ('cf200000-0000-4000-8000-000000000003', 'cf000000-0000-4000-8000-000000000001', 'North archive', 'residual', array[3], '08:00','10:00','North area','archived','cf100000-0000-4000-8000-000000000004','cf100000-0000-4000-8000-000000000004'),
 ('cf200000-0000-4000-8000-000000000004', 'cf000000-0000-4000-8000-000000000002', 'South published', 'residual', array[5], '08:00','10:00','South area','published','cf100000-0000-4000-8000-000000000005','cf100000-0000-4000-8000-000000000005');

insert into public.reports(id, owner_id, original_barangay_id, title, category_code, location_text, description, status) values
 ('cf300000-0000-4000-8000-000000000001','cf100000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000001','Resident A concern','test_dumping','North street','Synthetic report for resident A.','in_progress'),
 ('cf300000-0000-4000-8000-000000000002','cf100000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000001','Resident B concern','test_dumping','North street','Synthetic report for resident B.','pending_review'),
 ('cf300000-0000-4000-8000-000000000003','cf100000-0000-4000-8000-000000000003','cf000000-0000-4000-8000-000000000002','Resident C concern','test_collection','South street','Synthetic report for resident C.','pending_review');

insert into public.report_events(id, report_id, actor_id, event_type, previous_status, next_status, visibility, note) values
 ('cf400000-0000-4000-8000-000000000001','cf300000-0000-4000-8000-000000000001','cf100000-0000-4000-8000-000000000001','created',null,'pending_review','resident','Report submitted'),
 ('cf400000-0000-4000-8000-000000000002','cf300000-0000-4000-8000-000000000001','cf100000-0000-4000-8000-000000000004','status_changed','pending_review','in_progress','resident','Review started'),
 ('cf400000-0000-4000-8000-000000000003','cf300000-0000-4000-8000-000000000001','cf100000-0000-4000-8000-000000000004','internal_note',null,null,'internal','PRIVATE_OFFICER_NOTE'),
 ('cf400000-0000-4000-8000-000000000004','cf300000-0000-4000-8000-000000000002','cf100000-0000-4000-8000-000000000002','created',null,'pending_review','resident','Report submitted'),
 ('cf400000-0000-4000-8000-000000000005','cf300000-0000-4000-8000-000000000003','cf100000-0000-4000-8000-000000000003','created',null,'pending_review','resident','Report submitted');

create temporary table media_results(label text primary key,id uuid);
grant select,insert on media_results to authenticated;
-- A deliberately broad legacy policy must NOT bypass our restrictive guards.
create policy test_legacy_broad on storage.objects for all to public using(true) with check(true);
set local role anon;
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'42501','anonymous prepare denied');
select pg_temp.expect_error('select * from public.resident_media','42501','anonymous metadata denied');
reset role;
select set_config('request.jwt.claim.sub','cf100000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into media_results select 'scan',id from public.prepare_resident_media('cf500000-0000-4000-8000-000000000001','scan',null,'glass','0.90000000','mobilenetv2-d0744dc70738-v1',3);
select pg_temp.assert_true((select count(*)=1 from public.resident_media),'owner sees reservation');
select pg_temp.assert_true((select state='uploading' and owner_id=auth.uid() and ready_at is null from public.resident_media),'prepare derives owner and incomplete state');
select pg_temp.assert_true((select id=(select id from media_results where label='scan') from public.prepare_resident_media('cf500000-0000-4000-8000-000000000001','scan',null,'glass','0.90000000','mobilenetv2-d0744dc70738-v1',3)),'prepare same key replays same reservation');
select pg_temp.expect_error($q$select public.prepare_resident_media('cf500000-0000-4000-8000-000000000001','scan',null,'metal','0.90000000','mobilenetv2-d0744dc70738-v1',3)$q$,'23505','key payload conflict denied');
select pg_temp.expect_error($q$select public.prepare_resident_media(null,'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'22023','missing key denied');
select pg_temp.expect_error($q$select public.prepare_resident_media('00000000-0000-0000-0000-000000000000','scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'22023','nil key denied');
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'hazardous','0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'22023','unsupported label denied');
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,null,'0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'22023','null label denied');
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','NaN','mobilenetv2-d0744dc70738-v1',3)$q$,'22023','invalid score denied');
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','1.1','mobilenetv2-d0744dc70738-v1',3)$q$,'22023','score above one denied');
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','unknown-model',3)$q$,'22023','unknown model denied');
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',2097153)$q$,'22023','oversized image denied');
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'report_photo','cf300000-0000-4000-8000-000000000002',null,null,null,3)$q$,'42501','same-community foreign report attachment denied');
select pg_temp.expect_error($q$update public.resident_media set state='ready'$q$,'42501','direct metadata mutation denied');
select pg_temp.expect_error($q$delete from public.resident_media$q$,'42501','direct metadata deletion denied');
select pg_temp.expect_error($q$select public.finalize_resident_media((select id from media_results where label='scan'))$q$,'P0002','missing upload never becomes ready');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name,owner_id,metadata) values('resident-media','arbitrary.jpg',auth.uid()::text,'{"size":3,"mimetype":"image/jpeg"}')$q$,'42501','unreserved path denied despite broad legacy policy');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name,owner_id,metadata) select 'resident-media',auth.uid()::text||'/'||id::text||'.jpg','cf100000-0000-4000-8000-000000000002','{"size":3,"mimetype":"image/jpeg"}' from media_results where label='scan'$q$,'42501','spoofed object owner denied');
insert into storage.objects(bucket_id,name,owner_id,metadata) select 'resident-media',auth.uid()::text||'/'||id::text||'.jpg',auth.uid()::text,'{"size":3,"mimetype":"text/html"}' from media_results where label='scan';
select pg_temp.expect_error($q$select public.finalize_resident_media((select id from media_results where label='scan'))$q$,'22023','wrong MIME cannot finalize');
update storage.objects set metadata='{"size":3,"mimetype":"image/jpeg"}';
select pg_temp.assert_true((select metadata->>'mimetype'='text/html' from storage.objects),'object update blocked despite broad legacy policy');
reset role;
-- Only the local fixture simulates the Storage server writing trusted metadata.
update storage.objects set metadata='{"size":4,"mimetype":"image/jpeg"}';
set local role authenticated;
select pg_temp.expect_error($q$select public.finalize_resident_media((select id from media_results where label='scan'))$q$,'22023','size mismatch cannot finalize');
reset role;
update storage.objects set metadata='{"size":3,"mimetype":"image/jpeg"}';
set local role authenticated;
select pg_temp.assert_true((select state='ready' and ready_at is not null from public.finalize_resident_media((select id from media_results where label='scan'))),'photo finalizes after matching Storage metadata');
select pg_temp.assert_true((select id=(select id from media_results where label='scan') from public.finalize_resident_media((select id from media_results where label='scan'))),'finalize retry returns same record');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name,owner_id,metadata) select 'resident-media',auth.uid()::text||'/'||id::text||'.jpg',auth.uid()::text,'{"size":3,"mimetype":"image/jpeg"}' from media_results where label='scan'$q$,'42501','ready photo cannot be overwritten or reinserted');
delete from storage.objects;
select pg_temp.assert_true((select count(*)=1 from storage.objects),'ready object cannot be directly removed before begin command');
insert into media_results select 'report',id from public.prepare_resident_media('cf500000-0000-4000-8000-000000000002','report_photo','cf300000-0000-4000-8000-000000000001',null,null,null,3);
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'report_photo','cf300000-0000-4000-8000-000000000001',null,null,null,3)$q$,'23505','one active photo per report');
reset role;
select set_config('request.jwt.claim.sub','cf100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.resident_media),'same-community foreign media hidden');
select pg_temp.assert_true((select count(*)=0 from storage.objects),'foreign Storage bytes hidden despite broad legacy policy');
select pg_temp.expect_error($q$select public.finalize_resident_media((select id from media_results where label='scan'))$q$,'42501','foreign finalize denied');
select pg_temp.expect_error($q$select public.begin_resident_media_delete((select id from media_results where label='scan'))$q$,'42501','foreign removal denied');
select pg_temp.expect_error($q$select public.finish_resident_media_delete((select id from media_results where label='scan'))$q$,'42501','foreign removal finish denied');
reset role;
select set_config('request.jwt.claim.sub','cf100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.finish_resident_media_delete((select id from media_results where label='scan'))$q$,'22023','removal requires begin command');
select pg_temp.assert_true((select state='delete_pending' from public.begin_resident_media_delete((select id from media_results where label='scan'))),'removal begins with recoverable state');
select pg_temp.expect_error($q$select public.finish_resident_media_delete((select id from media_results where label='scan'))$q$,'22023','record cannot disappear while Storage object remains');
delete from storage.objects;
select pg_temp.assert_true((select count(*)=0 from storage.objects),'Storage API metadata removal allowed during removal state');
select pg_temp.assert_true((select state='deleted' and label is null and score is null and model_version is null from public.finish_resident_media_delete((select id from media_results where label='scan'))),'removal scrubs result metadata and keeps tombstone key');
select pg_temp.assert_true((select state='deleted' from public.finish_resident_media_delete((select id from media_results where label='scan'))),'removal finish is idempotent');
select pg_temp.assert_true((select state='deleted' from public.prepare_resident_media('cf500000-0000-4000-8000-000000000001','scan',null,'glass','0.90000000','mobilenetv2-d0744dc70738-v1',3)),'old upload key cannot resurrect deleted scan');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name,owner_id,metadata) select 'resident-media',auth.uid()::text||'/'||id::text||'.jpg',auth.uid()::text,'{"size":3,"mimetype":"image/jpeg"}' from media_results where label='scan'$q$,'42501','late upload denied after deletion');
select pg_temp.assert_true((select count(*)=1 from public.resident_media),'deleted scan hidden; report reservation remains');
reset role;
select set_config('request.jwt.claim.sub','cf100000-0000-4000-8000-000000000004',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'42501','officer cannot submit resident media');
reset role;
select set_config('request.jwt.claim.sub','cf100000-0000-4000-8000-000000000006',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'42501','admin cannot submit resident media');
reset role;
select set_config('request.jwt.claim.sub','cf100000-0000-4000-8000-000000000007',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'42501','unverified cannot submit resident media');
reset role;
select set_config('request.jwt.claim.sub','cf100000-0000-4000-8000-000000000008',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'42501','disabled cannot submit resident media');
reset role;
select set_config('request.jwt.claim.sub','cf100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3);
select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3);
select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3);
select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3);
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'22023','pending reservation quota enforced');
reset role;
insert into public.resident_media(owner_id,request_id,kind,label,score,model_version,byte_size,state,ready_at)
select 'cf100000-0000-4000-8000-000000000002',gen_random_uuid(),'scan','paper','1.00000000','mobilenetv2-d0744dc70738-v1',3,'ready',now() from generate_series(1,200);
select set_config('request.jwt.claim.sub','cf100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.prepare_resident_media(gen_random_uuid(),'scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3)$q$,'22023','scan history quota enforced');
select pg_temp.assert_true((select state='deleted' from public.cancel_resident_media_request('cf500000-0000-4000-8000-000000000099','scan')),'local-only cancellation works at full quota');
select pg_temp.assert_true((select state='deleted' from public.prepare_resident_media('cf500000-0000-4000-8000-000000000099','scan',null,'glass','0.9','mobilenetv2-d0744dc70738-v1',3)),'delayed prepare cannot resurrect a pre-cancelled upload');

reset role;
update public.account_access set enabled=false where user_id='cf100000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','cf100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.resident_media),'disabled resident cannot read media');
select pg_temp.expect_error($q$select public.begin_resident_media_delete((select id from media_results where label='report'))$q$,'42501','disabled resident cannot mutate media');
reset role;
rollback;
