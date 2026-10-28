-- Read-only structural checks. Does not enable automation or create test users.
select
 has_function_privilege('authenticated','public.get_resident_history(timestamptz,text,text,text)','EXECUTE') as authenticated_history,
 has_function_privilege('anon','public.get_resident_history(timestamptz,text,text,text)','EXECUTE') as anonymous_history,
 has_function_privilege('authenticated','public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE') as client_verifier,
 has_function_privilege('service_role','public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE') as private_worker_verifier;
select auto_awards_enabled,daily_awards,daily_points,hourly_starts,daily_starts from public.scan_reward_config where id=1;
select pg_get_constraintdef(oid) as claim_constraint from pg_catalog.pg_constraint where conrelid='public.disposal_claims'::regclass and conname='claim_valid';
