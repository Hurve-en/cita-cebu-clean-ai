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

insert into public.cleanup_events(id,barangay_id,title,location,instructions,starts_at,ends_at,points,capacity,created_by) values
('ea200000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','Active cleanup','Community park','Collect and sort safely',now()-interval '1 hour',now()+interval '1 hour',50,20,'da100000-0000-4000-8000-000000000003'),
('ea200000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000002','Foreign cleanup','Other community','Collect and sort safely',now()-interval '1 hour',now()+interval '1 hour',50,20,'da100000-0000-4000-8000-000000000004'),
('ea200000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001','Future cleanup','Community park','Collect and sort safely',now()+interval '1 hour',now()+interval '2 hours',50,20,'da100000-0000-4000-8000-000000000003');
insert into public.cleanup_participants(id,owner_id,event_id) values
('ea500000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000001'),
('ea500000-0000-4000-8000-000000000002','da100000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000003');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
select pg_temp.expect_error($$select public.start_scan_capture(gen_random_uuid(),'da000000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000001')$$,'22023','ongoing event still requires prior registration');
reset role;
update public.cleanup_events set ends_at=now()+interval '30 seconds' where id='ea200000-0000-4000-8000-000000000001';
-- Independent earning cap is already reached. Cleanup evidence must still work.
insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id)
select 'da100000-0000-4000-8000-000000000001',10,'scan',gen_random_uuid(),'da100000-0000-4000-8000-000000000003' from generate_series(1,3);
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select pg_temp.assert_true(jsonb_array_length(public.get_scan_cleanup_options()->'events')=1,'only active joined own-community cleanup returned');
select pg_temp.expect_error($$select public.start_scan_capture(gen_random_uuid(),'da000000-0000-4000-8000-000000000001',null)$$,'22023','independent cap enforced through unified RPC');
select pg_temp.expect_error($$select public.start_scan_capture(gen_random_uuid(),'da000000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000003')$$,'22023','future joined event not active');
select pg_temp.expect_error($$select public.start_scan_capture(gen_random_uuid(),'da000000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000002')$$,'22023','foreign event blocked');
select set_config('test.unified',(public.start_scan_capture('ea400000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000001')).id::text,true);
select pg_temp.assert_true((public.start_scan_capture('ea400000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000001')).id=current_setting('test.unified')::uuid,'event retry returns stable session despite independent cap');
select pg_temp.expect_error($$select public.start_scan_capture('ea400000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001',null)$$,'23505','retry cannot relabel event as independent');
select pg_temp.expect_error($$select public.start_reward_scan('ea400000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001')$$,'23505','legacy entry cannot relabel event capture');
select pg_temp.expect_error($$select public.start_scan_capture(gen_random_uuid(),'da000000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000001')$$,'22023','event starts share cooldown');
reset role;
select pg_temp.assert_true((select expires_at<=now()+interval '30 seconds' from public.scan_reward_sessions where id=current_setting('test.unified')::uuid),'event capture cannot outlive event end');
insert into public.resident_media(id,owner_id,request_id,kind,byte_size,state,ready_at,label,score,model_version) values
('ea300000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','ea400000-0000-4000-8000-000000000001','scan',4,'ready',now(),'plastic','0.9','mobilenetv2-d0744dc70738-v1'),
('ea300000-0000-4000-8000-000000000002','da100000-0000-4000-8000-000000000001','ea400000-0000-4000-8000-000000000002','disposal_photo',4,'ready',now(),null,null,null);
update public.cleanup_events set status='cancelled' where id='ea200000-0000-4000-8000-000000000001';set local role authenticated;
select pg_temp.expect_error($$select public.submit_reward_scan(current_setting('test.unified')::uuid,'ea300000-0000-4000-8000-000000000001','ea300000-0000-4000-8000-000000000002')$$,'22023','cancelled event cannot accept evidence');
reset role;update public.cleanup_events set status='published' where id='ea200000-0000-4000-8000-000000000001';
update public.cleanup_participants set status='cancelled' where id='ea500000-0000-4000-8000-000000000001';set local role authenticated;
select pg_temp.expect_error($$select public.submit_reward_scan(current_setting('test.unified')::uuid,'ea300000-0000-4000-8000-000000000001','ea300000-0000-4000-8000-000000000002')$$,'22023','withdrawn participant cannot submit');
reset role;update public.cleanup_participants set status='joined' where id='ea500000-0000-4000-8000-000000000001';set local role authenticated;
select pg_temp.assert_true((public.submit_reward_scan(current_setting('test.unified')::uuid,'ea300000-0000-4000-8000-000000000001','ea300000-0000-4000-8000-000000000002')).status='pending','event evidence remains pending');
select pg_temp.assert_true(public.get_today_scan_rewards()->'activity'->0->>'cleanup_event_id'='ea200000-0000-4000-8000-000000000001','same saved history scan attributed to event');
reset role;update public.scan_reward_config set auto_awards_enabled=true;set local role service_role;
select set_config('test.eventlease',(public.lease_scan_reward_review()).lease::text,true);
select pg_temp.assert_true((public.finish_scan_reward_review(current_setting('test.unified')::uuid,current_setting('test.eventlease')::uuid,repeat('a',64),repeat('b',64),'0123456789abcdef','fedcba9876543210','eligible','Disposal evidence appears consistent','vision-test')).status='review','AI cannot automatically award cleanup participation');
reset role;
select pg_temp.assert_true((select sum(amount)=30 from public.reward_ledger),'event verification creates no independent or cleanup credit');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);set local role authenticated;
select pg_temp.expect_error($$select public.review_scan_reward(current_setting('test.unified')::uuid,true,'Reviewed event evidence')$$,'22023','staff cannot mint per-photo event credits');
select pg_temp.expect_error($$select public.verify_cleanup_participation('ea500000-0000-4000-8000-000000000001',true,'Confirmed attendance and cleanup')$$,'22023','participation verification waits for event end');
reset role;update public.cleanup_events set ends_at=now()-interval '1 minute' where id='ea200000-0000-4000-8000-000000000001';set local role authenticated;
select public.verify_cleanup_participation('ea500000-0000-4000-8000-000000000001',true,'Confirmed attendance and cleanup');
select public.verify_cleanup_participation('ea500000-0000-4000-8000-000000000001',true,'Confirmed attendance and cleanup');
reset role;
select pg_temp.assert_true((select count(*)=1 and sum(amount)=50 from public.reward_ledger where kind='cleanup'),'cleanup participation earns one larger award across retries');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);set local role authenticated;
select pg_temp.assert_true(public.get_reward_balance()=80,'cleanup award is separate from independent daily cap');
select pg_temp.assert_true(public.get_today_scan_rewards()->'activity'->0->>'participation_status'='completed','today shows actual event participation result');
select pg_temp.assert_true((public.get_today_scan_rewards()->'activity'->0->>'cleanup_awarded_points')::int=50,'event reward shown from confirmed participation');
reset role;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
select pg_temp.assert_true(jsonb_array_length(public.get_scan_cleanup_options()->'events')=0,'other account sees no joined options');
select pg_temp.expect_error($$select public.start_scan_capture(gen_random_uuid(),'da000000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000003')$$,'22023','cannot select a future or unjoined cleanup');
select pg_temp.assert_true((public.start_scan_capture('ea400000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001',null)).cleanup_event_id is null,'independent scan still starts normally');
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.start_scan_capture(uuid,uuid,uuid)','EXECUTE'),'anonymous cannot start unified capture');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE'),'replacement preserves worker-only grants');
rollback;

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

-- Older saved scans and gallery scans are intentionally treated as unverified evidence.
insert into public.resident_media(id,owner_id,request_id,kind,byte_size,state,created_at,ready_at,label,score,model_version) values
('fa300000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000001','scan',4,'ready',now()-interval '7 days',now()-interval '7 days','plastic','0.9','mobilenetv2-d0744dc70738-v1'),
('fa300000-0000-4000-8000-000000000002','da100000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000002','scan',4,'ready',now()-interval '1 day',now()-interval '1 day','glass','0.8','mobilenetv2-d0744dc70738-v1'),
('fa300000-0000-4000-8000-000000000003','da100000-0000-4000-8000-000000000002','fa400000-0000-4000-8000-000000000003','scan',4,'ready',now(),now(),'metal','0.8','mobilenetv2-d0744dc70738-v1');
update public.scan_reward_config set auto_awards_enabled=true;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select pg_temp.expect_error($$select public.submit_disposal_claim('fa600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001',null,'Waste bin','Sorted and disposed correctly')$$,'22023','single-photo request must bind its activity first');
select set_config('test.manual',(public.start_scan_capture('fa600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001',null)).id::text,true);
select set_config('test.claim',(public.submit_disposal_claim('fa600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001',null,'Waste bin','Sorted and disposed correctly')).id::text,true);
select pg_temp.assert_true((public.submit_disposal_claim('fa600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001',null,'Waste bin','Sorted and disposed correctly')).id=current_setting('test.claim')::uuid,'one-photo submission retry returns original claim');
select pg_temp.assert_true(public.get_reward_balance()=0,'classification and submission grant no points');
select pg_temp.assert_true((select status='review' and verifier='manual-review-required' from public.scan_reward_sessions where id=current_setting('test.manual')::uuid),'single-photo workflow is manual review even when auto flag is on');
select pg_temp.expect_error($$select public.submit_disposal_claim('fa600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001',null,'Another bin','Sorted and disposed correctly')$$,'23505','retry cannot alter details');
select pg_temp.expect_error($$select public.begin_resident_media_delete('fa300000-0000-4000-8000-000000000001')$$,'22023','submitted saved scan is retained');
reset role;set local role service_role;
select pg_temp.assert_true((public.lease_scan_reward_review()).id is null,'private worker cannot lease manual-only photo submissions');
reset role;
update public.scan_reward_sessions set created_at=now()-interval '2 minutes' where id=current_setting('test.manual')::uuid;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);set local role authenticated;
select set_config('test.unused',(public.start_scan_capture('fa600000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001',null)).id::text,true);
select pg_temp.expect_error($$select public.submit_disposal_claim('fa600000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001',null,'Waste bin','Sorted and disposed correctly')$$,'23505','same saved photo cannot support another claim');
select pg_temp.expect_error($$select public.submit_disposal_claim('fa600000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000003',null,'Waste bin','Sorted and disposed correctly')$$,'42501','foreign saved photo cannot be submitted');
reset role;select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);set local role authenticated;
select pg_temp.expect_error($$select public.review_disposal_claim(current_setting('test.claim')::uuid,true,'Evidence and action reviewed')$$,'42501','foreign community staff cannot approve');
reset role;select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select pg_temp.expect_error($$select public.review_disposal_claim(current_setting('test.claim')::uuid,true,'Evidence and action reviewed')$$,'42501','manual review requires staff MFA');
reset role;select set_config('request.jwt.claims','{"aal":"aal2"}',true);set local role authenticated;
select public.review_disposal_claim(current_setting('test.claim')::uuid,true,'Evidence and action reviewed');
select public.review_scan_reward(current_setting('test.manual')::uuid,true,'Evidence and action reviewed');
reset role;
select pg_temp.assert_true((select count(*)=1 and sum(amount)=10 from public.reward_ledger),'both review entry points converge on one disposal award');
select pg_temp.assert_true((select status='approved' from public.scan_reward_sessions where id=current_setting('test.manual')::uuid),'review status follows manual claim decision');
-- Event photos are supporting evidence; event points still come only from attendance confirmation.
insert into public.cleanup_events(id,barangay_id,title,location,instructions,starts_at,ends_at,points,capacity,created_by) values
('fa200000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','Active cleanup','Community park','Collect and sort safely',now()-interval '1 hour',now()+interval '1 hour',50,20,'da100000-0000-4000-8000-000000000003');
insert into public.cleanup_participants(id,owner_id,event_id) values('fa500000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001');
insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) select 'da100000-0000-4000-8000-000000000001',10,'scan',gen_random_uuid(),'da100000-0000-4000-8000-000000000003' from generate_series(1,2);
update public.scan_reward_sessions set created_at=now()-interval '2 minutes' where owner_id='da100000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select set_config('test.eventmanual',(public.start_scan_capture('fa600000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001')).id::text,true);
select set_config('test.eventclaim',(public.submit_disposal_claim('fa600000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000002',null,'Community park','Collected and sorted during cleanup')).id::text,true);
select pg_temp.assert_true((select points=50 and status='pending' and after_id is null from public.disposal_claims where id=current_setting('test.eventclaim')::uuid),'event form stores actual event award and single photo');
reset role;select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);set local role authenticated;
select pg_temp.expect_error($$select public.review_disposal_claim(current_setting('test.eventclaim')::uuid,true,'Reviewed event evidence')$$,'22023','photo approval alone cannot grant event points');
reset role;update public.cleanup_events set ends_at=now()-interval '1 minute' where id='fa200000-0000-4000-8000-000000000001';set local role authenticated;
select public.verify_cleanup_participation('fa500000-0000-4000-8000-000000000001',true,'Confirmed attendance and cleanup');
select public.review_disposal_claim(current_setting('test.eventclaim')::uuid,true,'Reviewed event evidence');
select public.review_scan_reward(current_setting('test.eventmanual')::uuid,true,'Reviewed event evidence');
reset role;
select pg_temp.assert_true((select sum(amount)=80 from public.reward_ledger),'event claim approval adds no second reward beyond single participation credit');
select pg_temp.assert_true((select count(*)=1 from public.reward_ledger where kind='cleanup'),'cleanup points awarded once');
select pg_temp.assert_true((select count(*)=1 from public.reward_ledger where kind='disposal'),'event claim does not mint an independent disposal credit');

insert into public.resident_media(id,owner_id,request_id,kind,byte_size,state,created_at,ready_at,label,score,model_version) values
('fa300000-0000-4000-8000-000000000004','da100000-0000-4000-8000-000000000001','fa400000-0000-4000-8000-000000000004','scan',4,'ready',now()-interval '2 hours',now()-interval '2 hours','paper','0.8','mobilenetv2-d0744dc70738-v1');
update public.scan_reward_sessions set created_at=now()-interval '2 minutes' where owner_id='da100000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select pg_temp.assert_true(jsonb_array_length(public.get_scan_cleanup_options()->'events')=1,'completed joined event remains available for a saved-photo submission');
select pg_temp.assert_true((public.start_scan_capture('fa600000-0000-4000-8000-000000000004','da000000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001')).expires_at>now(),'late event submission receives a valid retry deadline');
select pg_temp.assert_true((public.submit_disposal_claim('fa600000-0000-4000-8000-000000000004','da000000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000004',null,'Community park','Saved evidence from the cleanup')).status='pending','event photo can be submitted after event end without claiming date authenticity');
select pg_temp.assert_true(public.get_reward_balance()=80,'later event photo adds no new points');
reset role;
rollback;
