-- Read-only, BEFORE the scan-guardrails update. Expected 0 / 0.
select
 (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('scan_reward_config','scan_reward_sessions','reward_image_fingerprints')) as conflicting_tables,
 (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('start_reward_scan','submit_reward_scan','get_today_scan_rewards','lease_scan_reward_review','finish_scan_reward_review','review_scan_reward')) as conflicting_commands;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='resident-media';
