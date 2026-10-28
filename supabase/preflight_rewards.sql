-- READ ONLY, before applying Part 7. Expected: 0, 0, 0.
select
 (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('reward_rules','reward_catalog','reward_ledger','reward_redemptions','disposal_claims','cleanup_events','cleanup_participants','unused_disposal_photos')) as conflicting_relations,
 (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('submit_disposal_claim','review_disposal_claim','create_cleanup_event','join_cleanup_event','verify_cleanup_participation','redeem_reward','cancel_reward_redemption','fulfill_reward_redemption','get_reward_balance','withdraw_cleanup_event')) as conflicting_commands,
 (select count(*) from public.resident_media where kind='disposal_photo') as conflicting_evidence;
-- Existing Part 6 bucket must remain private/JPEG/2 MiB.
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='resident-media';
