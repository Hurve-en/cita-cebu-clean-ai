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
select pg_temp.assert_true((select count(*)=7 from pg_catalog.pg_class where relnamespace='public'::regnamespace and relname in('reward_rules','reward_catalog','reward_ledger','disposal_claims','cleanup_events','cleanup_participants','reward_redemptions') and relrowsecurity),'seven tables RLS');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.reward_ledger','INSERT'),'closed ledger insert');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.reward_catalog','UPDATE'),'closed stock updates');
select pg_temp.assert_true(not has_table_privilege('anon','public.disposal_claims','SELECT'),'anonymous claims closed');
select pg_temp.assert_true(not has_function_privilege('anon','public.redeem_reward(uuid,uuid,uuid,integer)','EXECUTE'),'anonymous redeem closed');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
set local role authenticated;
select pg_temp.assert_true(public.get_reward_balance()=0,'new resident has zero verified points');
select pg_temp.assert_true((select count(*)=1 from public.reward_catalog),'hidden catalog unavailable');
select pg_temp.expect_error($$insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(auth.uid(),999,'disposal',gen_random_uuid(),auth.uid())$$,'42501','resident cannot mint points');
select pg_temp.expect_error($$select public.redeem_reward('da500000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','da200000-0000-4000-8000-000000000001',5)$$,'22023','insufficient balance');
select pg_temp.expect_error($$select public.submit_disposal_claim('da500000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000001','Waste bin','Sorted and correctly disposed waste')$$,'22023','distinct evidence required');
select set_config('test.claim', (public.submit_disposal_claim('da500000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000002','Waste bin','Sorted and correctly disposed waste')).id::text,true);
select pg_temp.assert_true(public.get_reward_balance()=0,'pending claim earns zero');
select pg_temp.assert_true((select count(*)=6 from public.unused_disposal_photos),'submitted photos no longer offered for reuse');
select pg_temp.assert_true((public.submit_disposal_claim('da500000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000002','Waste bin','Sorted and correctly disposed waste')).id=current_setting('test.claim')::uuid,'same key same claim');
select pg_temp.expect_error($$select public.submit_disposal_claim('da500000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000002','Other bin','Sorted and correctly disposed waste')$$,'23505','changed key payload rejected');
select pg_temp.expect_error($$select public.submit_disposal_claim('da500000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000002','da300000-0000-4000-8000-000000000003','Waste bin','Sorted and correctly disposed waste')$$,'23505','cross slot evidence reuse blocked');
select pg_temp.expect_error($$select public.begin_resident_media_delete('da300000-0000-4000-8000-000000000001')$$,'22023','submitted evidence retained');
select pg_temp.expect_error($$select public.review_disposal_claim(current_setting('test.claim')::uuid,true,'Verified correctly')$$,'42501','resident cannot approve own claim');
select set_config('test.upload',(public.prepare_resident_media('da450000-0000-4000-8000-000000000009','disposal_photo',null,null,null,null,4)).id::text,true);
select pg_temp.expect_error($$select public.finalize_resident_media(current_setting('test.upload')::uuid)$$,'P0002','disposal evidence requires an uploaded object');
insert into storage.objects(bucket_id,name,owner_id,metadata) values('resident-media',auth.uid()::text||'/'||current_setting('test.upload')||'.jpg',auth.uid()::text,'{"mimetype":"image/jpeg","size":4}');
select pg_temp.assert_true((public.finalize_resident_media(current_setting('test.upload')::uuid)).kind='disposal_photo','real upload protocol supports evidence without fake classification');
select public.begin_resident_media_delete(current_setting('test.upload')::uuid);
delete from storage.objects where name=auth.uid()::text||'/'||current_setting('test.upload')||'.jpg';
select pg_temp.assert_true((public.finish_resident_media_delete(current_setting('test.upload')::uuid)).state='deleted','unused evidence can be removed');

select set_config('test.claim2',(public.submit_disposal_claim('da500000-0000-4000-8000-000000000004','da000000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000003','da300000-0000-4000-8000-000000000004','Waste bin','Sorted and correctly disposed waste')).id::text,true);
select public.submit_disposal_claim('da500000-0000-4000-8000-000000000005','da000000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000005','da300000-0000-4000-8000-000000000006','Waste bin','Sorted and correctly disposed waste');
select pg_temp.expect_error($$select public.submit_disposal_claim('da500000-0000-4000-8000-000000000006','da000000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000007','da300000-0000-4000-8000-000000000008','Waste bin','Sorted and correctly disposed waste')$$,'22023','daily claim limit');
reset role;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.disposal_claims),'other account cannot read claims');
select pg_temp.expect_error($$select public.submit_disposal_claim('da500000-0000-4000-8000-000000000007','da000000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000007','da300000-0000-4000-8000-000000000008','Waste bin','Sorted and correctly disposed waste')$$,'42501','foreign evidence rejected');
reset role;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);set local role authenticated;
select pg_temp.expect_error($$select public.review_disposal_claim(current_setting('test.claim')::uuid,true,'Verified correctly')$$,'42501','foreign assigned officer blocked');
select pg_temp.assert_true((select count(*)=0 from public.disposal_claims),'foreign officer cannot read claim');
reset role;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select pg_temp.expect_error($$select public.review_disposal_claim(current_setting('test.claim')::uuid,true,'Verified correctly')$$,'42501','officer needs MFA');
reset role;select set_config('request.jwt.claims','{"aal":"aal2"}',true);set local role authenticated;
select pg_temp.assert_true((select count(*)=3 from public.disposal_claims),'assigned officer aal2 reads claims');
select pg_temp.assert_true(cebu_private.media_storage_access('da100000-0000-4000-8000-000000000001/da300000-0000-4000-8000-000000000001.jpg','select'),'assigned reviewer can read submitted evidence');
select pg_temp.assert_true(not cebu_private.media_storage_access('da100000-0000-4000-8000-000000000001/da300000-0000-4000-8000-000000000008.jpg','select'),'unsubmitted evidence hidden from staff');
select pg_temp.expect_error($$select public.review_disposal_claim(current_setting('test.claim')::uuid,true,'short')$$,'22023','review explanation required');
select public.review_disposal_claim(current_setting('test.claim')::uuid,true,'Verified correct disposal');
select public.review_disposal_claim(current_setting('test.claim')::uuid,true,'Verified correct disposal');
select pg_temp.expect_error($$select public.review_disposal_claim(current_setting('test.claim')::uuid,false,'Verified correct disposal')$$,'23505','cannot reverse reviewed claim');
select public.review_disposal_claim(current_setting('test.claim2')::uuid,false,'Evidence insufficient for approval');
select set_config('test.event',(public.create_cleanup_event('da000000-0000-4000-8000-000000000001','Community cleanup','Barangay hall','Bring gloves and follow sorting guidance',now()+interval '1 day',now()+interval '1 day 2 hours',1)).id::text,true);
reset role;
select pg_temp.assert_true((select sum(amount)=10 from public.reward_ledger where owner_id='da100000-0000-4000-8000-000000000001'),'approval once and rejection zero points');
select pg_temp.assert_true((select count(*)=1 from public.reward_ledger),'review replay no duplicate ledger');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select pg_temp.assert_true(public.get_reward_balance()=10,'verified independent award spendable');
select pg_temp.expect_error($$select public.redeem_reward('da600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','da200000-0000-4000-8000-000000000001',4)$$,'22023','stale price blocked');
reset role;
create function pg_temp.fail_ledger_write() returns trigger language plpgsql as $$begin raise exception using errcode='P0001',message='Test injected ledger failure';end;$$;
create trigger test_fail_reward_ledger before insert on public.reward_ledger for each row execute function pg_temp.fail_ledger_write();
set local role authenticated;
select pg_temp.expect_error($$select public.redeem_reward('da600000-0000-4000-8000-000000000009','da000000-0000-4000-8000-000000000001','da200000-0000-4000-8000-000000000001',5)$$,'P0001','ledger failure rolls back whole redemption');
select pg_temp.assert_true(public.get_reward_balance()=10,'failed redemption leaves balance unchanged');
select pg_temp.assert_true((select stock=2 from public.reward_catalog where id='da200000-0000-4000-8000-000000000001'),'failed redemption restores stock atomically');
select pg_temp.assert_true((select count(*)=0 from public.reward_redemptions),'failed redemption leaves no reservation');
reset role;drop trigger test_fail_reward_ledger on public.reward_ledger;set local role authenticated;
select set_config('test.redemption',(public.redeem_reward('da600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','da200000-0000-4000-8000-000000000001',5)).id::text,true);
select pg_temp.assert_true(public.get_reward_balance()=5,'reservation debits points');
select public.redeem_reward('da600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','da200000-0000-4000-8000-000000000001',5);
select pg_temp.assert_true(public.get_reward_balance()=5,'redemption retry debits only once');
select pg_temp.assert_true((select stock=1 from public.reward_catalog where id='da200000-0000-4000-8000-000000000001'),'stock reserved once');
select public.cancel_reward_redemption(current_setting('test.redemption')::uuid);
select public.cancel_reward_redemption(current_setting('test.redemption')::uuid);
select pg_temp.assert_true(public.get_reward_balance()=10,'cancel refund exactly once');
select pg_temp.assert_true((select stock=2 from public.reward_catalog where id='da200000-0000-4000-8000-000000000001'),'cancel restores stock once');
select pg_temp.assert_true((public.redeem_reward('da600000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','da200000-0000-4000-8000-000000000001',5)).status='cancelled','old request cannot resurrect cancellation');
select set_config('test.redemption2',(public.redeem_reward('da600000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','da200000-0000-4000-8000-000000000001',5)).id::text,true);
select set_config('test.participation',(public.join_cleanup_event(current_setting('test.event')::uuid,'da000000-0000-4000-8000-000000000001')).id::text,true);
select pg_temp.assert_true((public.join_cleanup_event(current_setting('test.event')::uuid,'da000000-0000-4000-8000-000000000001')).id=current_setting('test.participation')::uuid,'join retry one registration');
select pg_temp.assert_true(public.get_reward_balance()=5,'registration earns no points');
select public.withdraw_cleanup_event(current_setting('test.participation')::uuid);
select pg_temp.assert_true((public.withdraw_cleanup_event(current_setting('test.participation')::uuid)).status='cancelled','withdraw is retry safe');
select pg_temp.assert_true((public.join_cleanup_event(current_setting('test.event')::uuid,'da000000-0000-4000-8000-000000000001')).id=current_setting('test.participation')::uuid,'rejoin reuses original participation record');
reset role;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);set local role authenticated;
select pg_temp.expect_error($$select public.join_cleanup_event(current_setting('test.event')::uuid,'da000000-0000-4000-8000-000000000001')$$,'22023','capacity enforced');
select pg_temp.expect_error($$select public.cancel_reward_redemption(current_setting('test.redemption2')::uuid)$$,'42501','foreign redemption cannot cancel');
select pg_temp.assert_true((select count(*)=0 from public.reward_ledger),'foreign ledger hidden');
reset role;
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);set local role authenticated;
select pg_temp.expect_error($$select public.verify_cleanup_participation(current_setting('test.participation')::uuid,true,'Completed full participation')$$,'22023','cannot verify future cleanup');
select public.fulfill_reward_redemption(current_setting('test.redemption2')::uuid,'Reward collected at barangay hall');
select public.fulfill_reward_redemption(current_setting('test.redemption2')::uuid,'Reward collected at barangay hall');
select pg_temp.expect_error($$select public.fulfill_reward_redemption(current_setting('test.redemption')::uuid,'Reward collected at barangay hall')$$,'22023','cancelled cannot fulfill');
reset role;
update public.cleanup_events set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=current_setting('test.event')::uuid;
set local role authenticated;
select public.verify_cleanup_participation(current_setting('test.participation')::uuid,true,'Completed full participation');
select public.verify_cleanup_participation(current_setting('test.participation')::uuid,true,'Completed full participation');
reset role;
select pg_temp.assert_true((select sum(amount)=50 from public.reward_ledger where kind='cleanup'),'cleanup award larger and once');
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"aal":"aal1"}',true);set local role authenticated;
select pg_temp.assert_true(public.get_reward_balance()=55,'combined earning paths share balance');
select pg_temp.expect_error($$select public.cancel_reward_redemption(current_setting('test.redemption2')::uuid)$$,'22023','fulfilled cannot refund');
reset role;
update public.account_access set enabled=false where user_id='da100000-0000-4000-8000-000000000001';set local role authenticated;
select pg_temp.expect_error($$select public.get_reward_balance()$$,'42501','disabled cannot access balance');
select pg_temp.assert_true((select count(*)=0 from public.reward_ledger),'disabled ledger hidden');
reset role;
rollback;
