-- Run before deploying this update. Expected: 0 new columns / 0 new commands.
select
 (select count(*) from information_schema.columns where table_schema='public' and table_name='scan_reward_sessions' and column_name='cleanup_event_id') as conflicting_columns,
 (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('start_scan_capture','get_scan_cleanup_options')) as conflicting_commands;
