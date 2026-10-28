-- READ ONLY. Run each statement separately if the editor shows only the last result.
-- Seven rows: rls=true, anonymous_read=false, direct_insert/update/delete=false.
select c.relname,c.relrowsecurity as rls,
 has_table_privilege('anon','public.'||c.relname,'SELECT') as anonymous_read,
 has_table_privilege('authenticated','public.'||c.relname,'INSERT') as direct_insert,
 has_table_privilege('authenticated','public.'||c.relname,'UPDATE') as direct_update,
 has_table_privilege('authenticated','public.'||c.relname,'DELETE') as direct_delete
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('reward_rules','reward_catalog','reward_ledger','reward_redemptions','disposal_claims','cleanup_events','cleanup_participants') order by c.relname;
-- Ten rows: authenticated=true, anonymous=false.
select signature,has_function_privilege('authenticated',signature,'EXECUTE') as authenticated,
 has_function_privilege('anon',signature,'EXECUTE') as anonymous
from (values
 ('public.submit_disposal_claim(uuid,uuid,uuid,uuid,text,text)'),
 ('public.review_disposal_claim(uuid,boolean,text)'),
 ('public.create_cleanup_event(uuid,text,text,text,timestamp with time zone,timestamp with time zone,integer)'),
 ('public.join_cleanup_event(uuid,uuid)'),
 ('public.verify_cleanup_participation(uuid,boolean,text)'),
 ('public.redeem_reward(uuid,uuid,uuid,integer)'),
 ('public.cancel_reward_redemption(uuid)'),
 ('public.fulfill_reward_redemption(uuid,text)'),
 ('public.get_reward_balance()'),
 ('public.withdraw_cleanup_event(uuid)')
) as commands(signature);
-- Initial configurable defaults: 10 / 50 / 3. There is no free starting balance.
select * from public.reward_rules;
-- Original private bucket: false / 2097152 / {image/jpeg}.
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='resident-media';
-- Seven Storage policies, with the existing four restrictive guards.
select policyname,permissive,cmd,roles from pg_catalog.pg_policies
where schemaname='storage' and tablename='objects' and policyname like 'resident_media_%' order by policyname;
-- The unused-evidence view must honor caller RLS (security_invoker=true).
select c.relname,c.reloptions,has_table_privilege('anon','public.unused_disposal_photos','SELECT') as anonymous_read
from pg_catalog.pg_class c where c.oid='public.unused_disposal_photos'::regclass;
