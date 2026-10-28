-- Read-only. Three rows, RLS true, anonymous read and direct client writes false.
select c.relname,c.relrowsecurity as rls,
 has_table_privilege('anon','public.'||c.relname,'SELECT') as anonymous_read,
 has_table_privilege('authenticated','public.'||c.relname,'INSERT') as direct_insert,
 has_table_privilege('authenticated','public.'||c.relname,'UPDATE') as direct_update,
 has_table_privilege('authenticated','public.'||c.relname,'DELETE') as direct_delete
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('scan_reward_config','scan_reward_sessions','reward_image_fingerprints') order by c.relname;
-- Two rows: service_role=true, authenticated=false, anonymous=false.
select signature,has_function_privilege('service_role',signature,'EXECUTE') as service_role,
 has_function_privilege('authenticated',signature,'EXECUTE') as authenticated,
 has_function_privilege('anon',signature,'EXECUTE') as anonymous from(values
 ('public.lease_scan_reward_review()'),
 ('public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text)')
) as commands(signature);
-- Four rows: authenticated=true, anonymous=false. Staff review checks role/MFA inside RPC.
select signature,has_function_privilege('authenticated',signature,'EXECUTE') as authenticated,
 has_function_privilege('anon',signature,'EXECUTE') as anonymous from(values
 ('public.start_reward_scan(uuid,uuid)'),('public.submit_reward_scan(uuid,uuid,uuid)'),
 ('public.get_today_scan_rewards()'),('public.review_scan_reward(uuid,boolean,text)')
) as commands(signature);
-- Default: auto=false, awards=3, points=30, hourly=5, daily starts=10.
select * from public.scan_reward_config;
-- Seven existing bucket policies and four restrictive guards remain.
select policyname,permissive,cmd,roles from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname like 'resident_media_%' order by policyname;
-- Shared cap is enforced on ledger insertion, including older claim approval paths.
select tgname from pg_catalog.pg_trigger where tgrelid='public.reward_ledger'::regclass and tgname='independent_award_limit' and not tgisinternal;
