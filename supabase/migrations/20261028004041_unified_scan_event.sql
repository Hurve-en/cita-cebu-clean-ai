-- Source: backend/drizzle/0012_unified_scan_event.sql
-- Source SHA256: 549a7f8ed40e1bacee55b4182d21c018d93d38fe8e97b80df5e3677f5af4354e
BEGIN;
SET LOCAL search_path = public, pg_catalog;
ALTER TABLE "scan_reward_sessions" ADD COLUMN "cleanup_event_id" uuid;--> statement-breakpoint
ALTER TABLE "scan_reward_sessions" ADD CONSTRAINT "scan_reward_sessions_cleanup_event_id_cleanup_events_id_fk" FOREIGN KEY ("cleanup_event_id") REFERENCES "public"."cleanup_events"("id") ON DELETE no action ON UPDATE no action;
COMMIT;
