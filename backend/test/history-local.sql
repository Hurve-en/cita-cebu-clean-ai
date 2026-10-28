-- LOCAL SHIM ONLY. Never run against hosted Supabase; fake Storage rows are not real files.
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end;$$;
create function pg_temp.expect_error(statement text,expected text,label text) returns void language plpgsql as $$
declare actual text;begin begin execute statement;exception when others then get stacked diagnostics actual=returned_sqlstate;end;
if actual is distinct from expected then raise exception 'FAIL %: expected %, got %',label,expected,actual;end if;end;$$;
insert into public.barangays(id,name) values('da000000-0000-4000-8000-000000000001','TEST Rewards North'),('da000000-0000-4000-8000-000000000002','TEST Rewards South');
insert into auth.users(id,email,email_confirmed_at) values
('da100000-0000-4000-8000-000000000001','reward-a@example.test',now()),
('da100000-0000-4000-8000-000000000002','reward-b@example.test',now()),
('da100000-0000-4000-8000-000000000003','reward-north@example.test',now()),
('da100000-0000-4000-8000-000000000004','reward-south@example.test',now());
update public.profiles set resident_barangay_id='da000000-0000-4000-8000-000000000001';
update public.account_access set product_role='officer' where user_id in('da100000-0000-4000-8000-000000000003','da100000-0000-4000-8000-000000000004');
insert into public.officer_assignments(officer_id,barangay_id) values
('da100000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001'),
('da100000-0000-4000-8000-000000000004','da000000-0000-4000-8000-000000000002');

-- Twenty-three scans across both identities; deterministic ties exercise a shared global cursor.
insert into public.resident_media(id,owner_id,request_id,kind,byte_size,state,created_at,ready_at,label,score,model_version)
select ('fa300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 case when n=24 then 'da100000-0000-4000-8000-000000000002'::uuid else 'da100000-0000-4000-8000-000000000001'::uuid end,
 ('fa400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'scan',4,'ready',now()-interval '1 day',now()-interval '1 day','plastic','0.9','mobilenetv2-d0744dc70738-v1'
from generate_series(1,24)n;
insert into public.report_categories(code,label,enabled) values('test_waste','Waste concern',true);
insert into public.reports(id,owner_id,original_barangay_id,title,category_code,location_text,description,status)
values('fa700000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','Overflowing bin','test_waste','Community park','Please clear this overflowing bin','resolved');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select set_config('test.page',public.get_resident_history()::text,true);
select pg_temp.assert_true(jsonb_array_length(current_setting('test.page')::jsonb->'items')=20 and (current_setting('test.page')::jsonb->>'more')::boolean,'first history page bounded to twenty globally sorted records');
select pg_temp.assert_true(current_setting('test.page')::jsonb->'items'->0->>'kind'='report','global order merges reports and scans');
select pg_temp.assert_true(current_setting('test.page')::jsonb->'items'->0->>'status'='resolved','resolved concern is not relabeled verified');
select set_config('test.next',public.get_resident_history((current_setting('test.page')::jsonb->'next_cursor'->>'time')::timestamptz,current_setting('test.page')::jsonb->'next_cursor'->>'key')::text,true);
select pg_temp.assert_true(jsonb_array_length(current_setting('test.next')::jsonb->'items')=4 and not (current_setting('test.next')::jsonb->>'more')::boolean,'cursor reaches exactly the remaining owner records');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(current_setting('test.page')::jsonb->'items')a join jsonb_array_elements(current_setting('test.next')::jsonb->'items')b on a->>'key'=b->>'key'),'no duplicate page boundary');
select pg_temp.assert_true(jsonb_array_length(public.get_resident_history(null,null,'all','scan:fa300000-0000-4000-8000-000000000024')->'items')=0,'foreign direct lookup hidden');
select pg_temp.assert_true(jsonb_array_length(public.get_resident_history(null,null,'submitted')->'items')=1,'saved photos are separate from submitted concerns');
select pg_temp.expect_error($$select public.get_resident_history(now(),null)$$,'22023','partial cursor rejected');
select pg_temp.expect_error($$select public.get_resident_history(null,null,'magic')$$,'22023','unknown filter rejected');
select set_config('test.session',(public.start_scan_capture('fa600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001',null)).id::text,true);
select set_config('test.claim',(public.submit_disposal_claim('fa600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001',null,'Waste bin','Sorted and disposed correctly')).id::text,true);
select pg_temp.assert_true(public.get_resident_history(null,null,'all','scan:fa300000-0000-4000-8000-000000000001')->'items'->0->>'status'='checking','one photo becomes one pending verification item');
select pg_temp.assert_true(public.get_reward_balance()=0,'saving and submission never mint points');
reset role;set local role service_role;
select pg_temp.assert_true((public.lease_scan_reward_review()).id is null,'disabled automatic flag leases no new single-photo work');
reset role;update public.scan_reward_config set auto_awards_enabled=true;
set local role service_role;
select set_config('test.lease',(public.lease_scan_reward_review()).lease::text,true);
select pg_temp.expect_error($$select public.finish_scan_reward_review(current_setting('test.session')::uuid,gen_random_uuid(),repeat('a',64),null,'0123456789abcdef',null,'eligible','Visible evidence meets requirements','vision-test')$$,'42501','wrong lease cannot award');
select pg_temp.expect_error($$select public.finish_scan_reward_review(current_setting('test.session')::uuid,current_setting('test.lease')::uuid,repeat('a',64),repeat('b',64),'0123456789abcdef',null,'eligible','Visible evidence meets requirements','vision-test')$$,'22023','single verdict cannot smuggle a second hash');
select pg_temp.assert_true((public.finish_scan_reward_review(current_setting('test.session')::uuid,current_setting('test.lease')::uuid,repeat('a',64),null,'0123456789abcdef',null,'eligible','Visible evidence meets requirements','vision-test')).status='approved','private worker approves independent evidence');
select pg_temp.expect_error($$select public.finish_scan_reward_review(current_setting('test.session')::uuid,current_setting('test.lease')::uuid,repeat('a',64),null,'0123456789abcdef',null,'eligible','Visible evidence meets requirements','vision-test')$$,'42501','stale or repeated verdict cannot credit twice');
reset role;
select pg_temp.assert_true((select status='approved' and points=10 and reviewed_by is null and reviewed_at is not null from public.disposal_claims where id=current_setting('test.claim')::uuid),'machine decision does not invent a human reviewer');
select pg_temp.assert_true((select count(*)=1 and sum(amount)=10 from public.reward_ledger),'exactly ten backend points once');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);set local role authenticated;
select pg_temp.expect_error($$select public.review_disposal_claim(current_setting('test.claim')::uuid,true,'Officer cannot approve this')$$,'42501','officer claim endpoint blocked for independent');
select pg_temp.expect_error($$select public.review_scan_reward(current_setting('test.session')::uuid,true,'Officer cannot approve this')$$,'42501','officer scan endpoint blocked for independent');
reset role;
update public.scan_reward_sessions set created_at=now()-interval '2 minutes';
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select pg_temp.assert_true((public.submit_disposal_claim('fa600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001',null,'Waste bin','Sorted and disposed correctly')).status='approved','submission replay returns original approved claim');
select pg_temp.assert_true((public.get_resident_history(null,null,'all','scan:fa300000-0000-4000-8000-000000000001')->'items'->0->>'points')::int=10,'history points come from ledger');
select pg_temp.expect_error($$select public.begin_resident_media_delete('fa300000-0000-4000-8000-000000000001')$$,'22023','submitted evidence cannot be deleted');
select set_config('test.session2',(public.start_scan_capture('fa600000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001',null)).id::text,true);
select public.submit_disposal_claim('fa600000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000002',null,'Waste bin','Sorted and disposed correctly');
reset role;set local role service_role;
select set_config('test.lease2',(public.lease_scan_reward_review()).lease::text,true);
select pg_temp.assert_true((public.finish_scan_reward_review(current_setting('test.session2')::uuid,current_setting('test.lease2')::uuid,repeat('a',64),null,'0123456789abcdef',null,'eligible','Visible evidence meets requirements','vision-test')).status='rejected','duplicate cannot earn again');
reset role;
select pg_temp.assert_true((select sum(amount)=10 from public.reward_ledger),'duplicate has no second credit');
update public.scan_reward_sessions set created_at=now()-interval '2 minutes';
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);set local role authenticated;
select set_config('test.session3',(public.start_scan_capture('fa600000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001',null)).id::text,true);
select public.submit_disposal_claim('fa600000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000003',null,'Waste bin','Sorted and disposed correctly');
reset role;set local role service_role;
select set_config('test.lease3',(public.lease_scan_reward_review()).lease::text,true);
select pg_temp.assert_true((public.finish_scan_reward_review(current_setting('test.session3')::uuid,current_setting('test.lease3')::uuid,repeat('b',64),null,'fedcba9876543210',null,'review','Photo cannot be verified confidently','vision-test')).status='rejected','uncertain evidence receives no points or officer fallback');
reset role;
-- Current single-photo event process is unchanged: supporting photos do not mint per-photo rewards.
insert into public.cleanup_events(id,barangay_id,title,location,instructions,starts_at,ends_at,points,capacity,created_by) values
('fa200000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','Active cleanup','Community park','Collect and sort safely',now()-interval '1 hour',now()+interval '1 hour',50,20,'da100000-0000-4000-8000-000000000003');
insert into public.cleanup_participants(id,owner_id,event_id) values('fa500000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001');
update public.scan_reward_sessions set created_at=now()-interval '2 minutes';
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select set_config('test.eventsession',(public.start_scan_capture('fa600000-0000-4000-8000-000000000004','da000000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001')).id::text,true);
select set_config('test.eventclaim',(public.submit_disposal_claim('fa600000-0000-4000-8000-000000000004','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000004',null,'Community park','Collected waste during the event')).id::text,true);
select pg_temp.assert_true(public.get_resident_history(null,null,'all','scan:fa300000-0000-4000-8000-000000000004')->'items'->0->>'status'='pending','event supporting photo still uses officer review');
reset role;select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);set local role authenticated;
select pg_temp.expect_error($$select public.review_disposal_claim(current_setting('test.eventclaim')::uuid,true,'Reviewed event evidence')$$,'22023','participation must be confirmed before event evidence approval');
reset role;update public.cleanup_events set ends_at=now()-interval '1 minute' where id='fa200000-0000-4000-8000-000000000001';set local role authenticated;
select public.verify_cleanup_participation('fa500000-0000-4000-8000-000000000001',true,'Confirmed attendance and cleanup');
select public.verify_cleanup_participation('fa500000-0000-4000-8000-000000000001',true,'Confirmed attendance and cleanup');
select public.review_disposal_claim(current_setting('test.eventclaim')::uuid,true,'Reviewed event evidence');
select public.review_scan_reward(current_setting('test.eventsession')::uuid,true,'Reviewed event evidence');
reset role;
select pg_temp.assert_true((select count(*)=1 and sum(amount)=50 from public.reward_ledger where kind='cleanup'),'event retains one participation credit across retries');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);set local role authenticated;
select pg_temp.assert_true((public.get_resident_history(null,null,'all','event:fa500000-0000-4000-8000-000000000001')->'items'->0->>'points')::int=50,'event participation carries its actual reward once');
select pg_temp.assert_true((public.get_resident_history(null,null,'all','scan:fa300000-0000-4000-8000-000000000004')->'items'->0->>'points')::int=0,'event photo does not repeat the participation reward');
select pg_temp.assert_true(public.get_reward_balance()=60,'independent and event credits add once');
reset role;
-- Daily upload reservations use the database clock and survive cancellation/deletion.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('resident-media','resident-media',false,2097152,array['image/jpeg']) on conflict(id)do nothing;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
do $$declare r public.resident_media;n integer;begin for n in 1..5 loop
 r:=public.prepare_resident_media(('fb400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'scan',null,'glass','0.8','mobilenetv2-d0744dc70738-v1',4);
end loop;end;$$;
reset role;update public.resident_media set state='deleted',label=null,score=null,model_version=null where request_id::text like 'fb400000-%';set local role authenticated;
do $$declare r public.resident_media;n integer;begin for n in 6..10 loop
 r:=public.prepare_resident_media(('fb400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'scan',null,'glass','0.8','mobilenetv2-d0744dc70738-v1',4);
end loop;end;$$;
select pg_temp.assert_true((public.prepare_resident_media('fb400000-0000-4000-8000-000000000006','scan',null,'glass','0.8','mobilenetv2-d0744dc70738-v1',4)).state='uploading','same request replay works after cap');
select pg_temp.expect_error($$select public.prepare_resident_media('fb400000-0000-4000-8000-000000000011','scan',null,'glass','0.8','mobilenetv2-d0744dc70738-v1',4)$$,'22023','eleventh new photo blocked even after tombstone deletion');
select pg_temp.assert_true(jsonb_array_length(public.get_resident_history()->'items')=6,'history reads remain available at upload cap and owner scoped');
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.get_resident_history(timestamptz,text,text,text)','EXECUTE'),'history is never anonymous');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE'),'mobile client cannot award points');

-- NEW pending-deletion behavior under the current nineteen-migration policy.
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);set local role authenticated;
select pg_temp.expect_error($$select public.withdraw_pending_scan('fa300000-0000-4000-8000-000000000001')$$,'22023','approved scan cannot be withdrawn');
select pg_temp.expect_error($$select public.withdraw_pending_scan('fa300000-0000-4000-8000-000000000002')$$,'22023','ordinary AI rejection is not a withdrawal marker');
select pg_temp.expect_error($$select public.withdraw_pending_scan('fa300000-0000-4000-8000-000000000004')$$,'22023','event evidence process is unchanged');
select pg_temp.expect_error($$select public.withdraw_pending_scan('fa300000-0000-4000-8000-000000000024')$$,'42501','foreign photo cannot be withdrawn');
reset role;
insert into storage.objects(bucket_id,name,owner_id,metadata) values('resident-media','da100000-0000-4000-8000-000000000002/fa300000-0000-4000-8000-000000000024.jpg','da100000-0000-4000-8000-000000000002','{"mimetype":"image/jpeg","size":4}');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
select set_config('test.withdrawsession',(public.start_scan_capture('fc600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001',null)).id::text,true);
select set_config('test.withdrawclaim',(public.submit_disposal_claim('fc600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000024',null,'Waste bin','Sorted and disposed correctly')).id::text,true);
select pg_temp.expect_error($$select public.begin_resident_media_delete('fa300000-0000-4000-8000-000000000024')$$,'22023','normal deletion cannot bypass a pending claim');
reset role;set local role service_role;
select set_config('test.withdrawlease',(public.lease_scan_reward_review()).lease::text,true);
reset role;select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
select pg_temp.assert_true((public.withdraw_pending_scan('fa300000-0000-4000-8000-000000000024')).state='delete_pending','withdrawal invalidates active AI work and begins byte-removal protocol');
select pg_temp.assert_true((public.withdraw_pending_scan('fa300000-0000-4000-8000-000000000024')).state='delete_pending','lost withdrawal response can replay safely');
select pg_temp.expect_error($$select public.finish_resident_media_delete('fa300000-0000-4000-8000-000000000024')$$,'22023','finish cannot pretend bytes were deleted');
select pg_temp.assert_true(public.get_resident_history(null,null,'all','scan:fa300000-0000-4000-8000-000000000024')->'items'->0->>'note'='Withdrawn by resident; no points awarded','unfinished byte deletion remains discoverable for retry');
reset role;set local role service_role;
select pg_temp.expect_error($$select public.finish_scan_reward_review(current_setting('test.withdrawsession')::uuid,current_setting('test.withdrawlease')::uuid,repeat('c',64),null,'0123456789abcdef',null,'eligible','Visible evidence meets requirements','vision-test')$$,'42501','a worker already processing the photo cannot award after withdrawal');
reset role;select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
select pg_temp.assert_true((public.begin_resident_media_delete('fa300000-0000-4000-8000-000000000024')).state='delete_pending','withdrawn scan uses existing begin deletion');
delete from storage.objects where bucket_id='resident-media' and name='da100000-0000-4000-8000-000000000002/fa300000-0000-4000-8000-000000000024.jpg';
select pg_temp.assert_true((public.finish_resident_media_delete('fa300000-0000-4000-8000-000000000024')).state='deleted','confirmed Storage removal scrubs media and removes history item');
select pg_temp.assert_true((public.withdraw_pending_scan('fa300000-0000-4000-8000-000000000024')).state='deleted','completed removal is idempotent');
select pg_temp.assert_true(jsonb_array_length(public.get_resident_history(null,null,'all','scan:fa300000-0000-4000-8000-000000000024')->'items')=0,'deleted pending scan is absent from history');
select pg_temp.assert_true((select count(*)=1 from public.disposal_claims where id=current_setting('test.withdrawclaim')::uuid and status='rejected'),'withdrawal retains quota and retry record');
select pg_temp.assert_true(public.get_reward_balance()=0,'withdrawal never mints or reverses points');
select pg_temp.expect_error($$select public.prepare_resident_media('fb400000-0000-4000-8000-000000000011','scan',null,'glass','0.8','mobilenetv2-d0744dc70738-v1',4)$$,'22023','withdrawal does not reset daily media quota');
select pg_temp.assert_true((public.prepare_resident_media('fa400000-0000-4000-8000-000000000024','scan',null,'plastic','0.9','mobilenetv2-d0744dc70738-v1',4)).state='deleted','stale upload cannot resurrect deleted pending photo');
reset role;
select pg_temp.assert_true(not exists(select 1 from storage.objects where name like '%fa300000-0000-4000-8000-000000000024.jpg'),'fixture confirms object metadata actually removed');
select pg_temp.assert_true(not has_function_privilege('anon','public.withdraw_pending_scan(uuid)','EXECUTE'),'withdrawal is never anonymous');
select pg_temp.assert_true(not has_function_privilege('authenticated','cebu_private.is_withdrawn_scan(uuid)','EXECUTE'),'withdrawal helper is private');
rollback;
