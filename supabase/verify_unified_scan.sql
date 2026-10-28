-- One nullable UUID column.
select column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name='scan_reward_sessions' and column_name='cleanup_event_id';
-- One foreign key to cleanup_events.
select conname,pg_get_constraintdef(oid) as definition from pg_catalog.pg_constraint
where conrelid='public.scan_reward_sessions'::regclass and conname='scan_reward_sessions_cleanup_event_id_cleanup_events_id_fk';
-- Two rows: authenticated=true, anonymous=false.
select signature,has_function_privilege('authenticated',signature,'EXECUTE') as authenticated,
 has_function_privilege('anon',signature,'EXECUTE') as anonymous from(values
 ('public.start_scan_capture(uuid,uuid,uuid)'),('public.get_scan_cleanup_options()')) as commands(signature);
-- Worker remains private: service_role=true, authenticated=false, anonymous=false.
select has_function_privilege('service_role','public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE') as private_worker,
 has_function_privilege('authenticated','public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE') as client_verdict,
 has_function_privilege('anon','public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE') as anonymous_verdict;
-- Automatic award flag remains unchanged. Do not enable it before private worker evaluation.
select * from public.scan_reward_config;
-- After the corrected single-photo submission migration: one row, after_id / YES.
select column_name,is_nullable from information_schema.columns
where table_schema='public' and table_name='disposal_claims' and column_name='after_id';
