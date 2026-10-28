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
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('resident-media','resident-media',false,2097152,array['image/jpeg']);
insert into public.reward_catalog(id,name,description,cost,stock,enabled) values
('da200000-0000-4000-8000-000000000001','Test reward','Local fixture reward only',5,2,true),
('da200000-0000-4000-8000-000000000002','Hidden reward','Not published to residents',1,2,false);
-- Mock finalized evidence: no claim is made that SQL inserts upload real bytes.
insert into public.resident_media(id,owner_id,request_id,kind,byte_size,state,ready_at)
select ('da300000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'da100000-0000-4000-8000-000000000001',
('da400000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'disposal_photo',4,'ready',now() from generate_series(1,8) i;
select pg_temp.assert_true((select auto_awards_enabled=false from public.scan_reward_config),'automatic awards default off');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE'),'client cannot submit AI verdict');
select pg_temp.assert_true(not has_function_privilege('anon','public.lease_scan_reward_review()','EXECUTE'),'anonymous cannot lease work');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.reward_image_fingerprints','SELECT'),'global fingerprints are private');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select set_config('test.session',(public.start_reward_scan('db400000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001')).id::text,true);
select pg_temp.assert_true((public.start_reward_scan('db400000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001')).id=current_setting('test.session')::uuid,'start retry same challenge');
select pg_temp.expect_error($$select public.start_reward_scan('db400000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001')$$,'22023','cooldown enforced');
select pg_temp.expect_error($$select public.submit_reward_scan(current_setting('test.session')::uuid,'da300000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000002')$$,'22023','old photo and wrong media type cannot qualify');
reset role;
-- LOCAL fixture only: timestamps emulate fresh uploads inside a valid challenge.
insert into public.resident_media(id,owner_id,request_id,kind,byte_size,state,ready_at,label,score,model_version) values
('db300000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','db400000-0000-4000-8000-000000000001','scan',4,'ready',now(),'plastic','0.9','mobilenetv2-d0744dc70738-v1'),
('db300000-0000-4000-8000-000000000002','da100000-0000-4000-8000-000000000001','db400000-0000-4000-8000-000000000002','disposal_photo',4,'ready',now(),null,null,null);
set local role authenticated;
select pg_temp.assert_true((public.get_today_scan_rewards()->'activity'->0->>'session_id')=current_setting('test.session'),'saved scan linked by server request id');
select pg_temp.assert_true((public.submit_reward_scan(current_setting('test.session')::uuid,'db300000-0000-4000-8000-000000000001','db300000-0000-4000-8000-000000000002')).status='pending','valid capture pending not credited');
select pg_temp.assert_true(public.get_reward_balance()=0,'classification and pending verification earn zero');
select pg_temp.assert_true((public.submit_reward_scan(current_setting('test.session')::uuid,'db300000-0000-4000-8000-000000000001','db300000-0000-4000-8000-000000000002')).status='pending','submission replay safe');
select pg_temp.expect_error($$select public.begin_resident_media_delete('db300000-0000-4000-8000-000000000001')$$,'22023','submitted reward scan retained');
select pg_temp.expect_error($$select public.submit_disposal_claim('db500000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000001','db300000-0000-4000-8000-000000000002','Waste bin','Sorted and disposed correctly')$$,'23505','legacy claim cannot reuse scan reward evidence');
reset role;select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.scan_reward_sessions),'foreign sessions hidden');
select pg_temp.expect_error($$select public.submit_reward_scan(current_setting('test.session')::uuid,'db300000-0000-4000-8000-000000000001','db300000-0000-4000-8000-000000000002')$$,'42501','foreign submit blocked');
reset role;set local role service_role;
select set_config('test.lease',(public.lease_scan_reward_review()).lease::text,true);
select pg_temp.assert_true(current_setting('test.lease')<>'','worker obtains lease');
select pg_temp.expect_error($$select public.finish_scan_reward_review(current_setting('test.session')::uuid,gen_random_uuid(),repeat('a',64),repeat('b',64),'0123456789abcdef','fedcba9876543210','eligible','Evidence consistent with disposal','vision-test')$$,'42501','wrong lease blocked');
select pg_temp.assert_true((public.finish_scan_reward_review(current_setting('test.session')::uuid,current_setting('test.lease')::uuid,repeat('a',64),repeat('b',64),'0123456789abcdef','fedcba9876543210','eligible','Evidence consistent with disposal','vision-test')).status='review','flag off does not automatically award');
reset role;
select pg_temp.assert_true((select count(*)=0 from public.reward_ledger),'automatic flag off preserves zero balance');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000003',true);set local role authenticated;
select pg_temp.expect_error($$select public.review_scan_reward(current_setting('test.session')::uuid,true,'Verified disposal evidence')$$,'42501','staff needs aal2');
reset role;select set_config('request.jwt.claims','{"aal":"aal2"}',true);set local role authenticated;
select public.review_scan_reward(current_setting('test.session')::uuid,true,'Verified disposal evidence');
select public.review_scan_reward(current_setting('test.session')::uuid,true,'Verified disposal evidence');
reset role;
select pg_temp.assert_true((select sum(amount)=10 from public.reward_ledger),'staff review awards once');
-- Per-account daily cap applies even to old manual-claim award code paths.
insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values
('da100000-0000-4000-8000-000000000001',10,'disposal',gen_random_uuid(),'da100000-0000-4000-8000-000000000003'),
('da100000-0000-4000-8000-000000000001',10,'scan',gen_random_uuid(),'da100000-0000-4000-8000-000000000003');
select pg_temp.expect_error($$insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values('da100000-0000-4000-8000-000000000001',10,'scan',gen_random_uuid(),'da100000-0000-4000-8000-000000000003')$$,'22023','daily award and points cap');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);set local role authenticated;
select pg_temp.expect_error($$select public.start_reward_scan(gen_random_uuid(),'da000000-0000-4000-8000-000000000001')$$,'22023','capped owner cannot start another reward session');
select pg_temp.assert_true((public.get_today_scan_rewards()->>'earned_points')::int=30,'today summary derives credited points from ledger');
reset role;
-- A batch must observe its own preceding ledger inserts.
select pg_temp.expect_error($$insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id)
select 'da100000-0000-4000-8000-000000000002'::uuid,10,'scan',gen_random_uuid(),'da100000-0000-4000-8000-000000000003'::uuid from generate_series(1,4)$$,'22023','multi-row awards cannot exceed daily cap');
select pg_temp.assert_true((select count(*)=0 from public.reward_ledger where owner_id='da100000-0000-4000-8000-000000000002'),'rejected batch rolls back all awards');
-- Another resident verifies duplicated bytes: no second award even with auto on.
update public.scan_reward_config set auto_awards_enabled=true;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
select set_config('test.session2',(public.start_reward_scan('db400000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001')).id::text,true);
reset role;
insert into public.resident_media(id,owner_id,request_id,kind,byte_size,state,ready_at,label,score,model_version) values
('db300000-0000-4000-8000-000000000003','da100000-0000-4000-8000-000000000002','db400000-0000-4000-8000-000000000003','scan',4,'ready',now(),'glass','0.9','mobilenetv2-d0744dc70738-v1'),
('db300000-0000-4000-8000-000000000004','da100000-0000-4000-8000-000000000002','db400000-0000-4000-8000-000000000004','disposal_photo',4,'ready',now(),null,null,null);
set local role authenticated;
select public.submit_reward_scan(current_setting('test.session2')::uuid,'db300000-0000-4000-8000-000000000003','db300000-0000-4000-8000-000000000004');
reset role;set local role service_role;
select set_config('test.lease2',(public.lease_scan_reward_review()).lease::text,true);
select pg_temp.assert_true((public.finish_scan_reward_review(current_setting('test.session2')::uuid,current_setting('test.lease2')::uuid,repeat('a',64),repeat('c',64),'0123456789abcdef','5555555555555555','eligible','Evidence consistent with disposal','vision-test')).status='rejected','cross-account exact duplicate denied');
reset role;
select pg_temp.assert_true((select count(*)=0 from public.reward_ledger where owner_id='da100000-0000-4000-8000-000000000002'),'duplicate does not credit balance');

-- Configured automatic verification credits only fresh, non-duplicate evidence.
update public.scan_reward_sessions set created_at=now()-interval '2 minutes' where id=current_setting('test.session2')::uuid;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
select set_config('test.session3',(public.start_reward_scan('db400000-0000-4000-8000-000000000005','da000000-0000-4000-8000-000000000001')).id::text,true);
reset role;
insert into public.resident_media(id,owner_id,request_id,kind,byte_size,state,ready_at,label,score,model_version) values
('db300000-0000-4000-8000-000000000005','da100000-0000-4000-8000-000000000002','db400000-0000-4000-8000-000000000005','scan',4,'ready',now(),'metal','0.9','mobilenetv2-d0744dc70738-v1'),
('db300000-0000-4000-8000-000000000006','da100000-0000-4000-8000-000000000002','db400000-0000-4000-8000-000000000006','disposal_photo',4,'ready',now(),null,null,null);
set local role authenticated;
select public.submit_reward_scan(current_setting('test.session3')::uuid,'db300000-0000-4000-8000-000000000005','db300000-0000-4000-8000-000000000006');
reset role;set local role service_role;
select set_config('test.lease3',(public.lease_scan_reward_review()).lease::text,true);
select pg_temp.assert_true((public.finish_scan_reward_review(current_setting('test.session3')::uuid,current_setting('test.lease3')::uuid,repeat('d',64),repeat('e',64),'ffffffffffffffff','0000000000000000','eligible','Evidence consistent with disposal','vision-test')).status='approved','configured fresh review automatically awards');
select pg_temp.expect_error($$select public.finish_scan_reward_review(current_setting('test.session3')::uuid,current_setting('test.lease3')::uuid,repeat('d',64),repeat('e',64),'ffffffffffffffff','0000000000000000','eligible','Evidence consistent with disposal','vision-test')$$,'42501','used lease cannot credit again');
reset role;
select pg_temp.assert_true((select sum(amount)=10 from public.reward_ledger where owner_id='da100000-0000-4000-8000-000000000002'),'automatic award credits once');
update public.scan_reward_sessions set created_at=now()-interval '2 minutes' where id=current_setting('test.session3')::uuid;
update public.scan_reward_config set hourly_starts=1;
set local role authenticated;
select pg_temp.expect_error($$select public.start_reward_scan(gen_random_uuid(),'da000000-0000-4000-8000-000000000001')$$,'22023','hourly start limit persists across restarts');
reset role;update public.scan_reward_config set hourly_starts=5,daily_starts=2;set local role authenticated;
select pg_temp.expect_error($$select public.start_reward_scan(gen_random_uuid(),'da000000-0000-4000-8000-000000000001')$$,'22023','daily attempt limit separate from earning limit');
reset role;update public.scan_reward_config set daily_starts=10;set local role authenticated;
select set_config('test.expired',(public.start_reward_scan('db400000-0000-4000-8000-000000000007','da000000-0000-4000-8000-000000000001')).id::text,true);
reset role;
update public.scan_reward_sessions set created_at=now()-interval '10 minutes',expires_at=now()-interval '5 minutes' where id=current_setting('test.expired')::uuid;
set local role authenticated;
select pg_temp.expect_error($$select public.submit_reward_scan(current_setting('test.expired')::uuid,'db300000-0000-4000-8000-000000000005','db300000-0000-4000-8000-000000000006')$$,'22023','server rejects expired captures');
reset role;
select pg_temp.assert_true(to_char(cebu_private.reward_day_start() at time zone 'Asia/Manila','HH24:MI')='00:00','day starts at midnight Philippine time');
rollback;
