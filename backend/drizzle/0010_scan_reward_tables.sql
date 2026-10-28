CREATE TABLE "reward_image_fingerprints" (
	"sha256" text PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"dhash" text NOT NULL,
	CONSTRAINT "reward_fingerprint_valid" CHECK ("reward_image_fingerprints"."sha256" ~ '^[0-9a-f]{64}$' and "reward_image_fingerprints"."dhash" ~ '^[0-9a-f]{16}$')
);
--> statement-breakpoint
ALTER TABLE "reward_image_fingerprints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scan_reward_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"auto_awards_enabled" boolean DEFAULT false NOT NULL,
	"daily_awards" integer DEFAULT 3 NOT NULL,
	"daily_points" integer DEFAULT 30 NOT NULL,
	"hourly_starts" integer DEFAULT 5 NOT NULL,
	"daily_starts" integer DEFAULT 10 NOT NULL,
	CONSTRAINT "scan_config_valid" CHECK ("scan_reward_config"."id"=1 and "scan_reward_config"."daily_awards" between 1 and 10 and "scan_reward_config"."daily_points" between 1 and 1000 and "scan_reward_config"."hourly_starts" between 1 and 20 and "scan_reward_config"."daily_starts" between 1 and 50)
);
--> statement-breakpoint
ALTER TABLE "scan_reward_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scan_reward_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"barangay_id" uuid NOT NULL,
	"before_id" uuid,
	"after_id" uuid,
	"fingers" integer NOT NULL,
	"points" integer NOT NULL,
	"status" text DEFAULT 'capture' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"lease" uuid,
	"leased_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"verifier" text,
	CONSTRAINT "scan_reward_valid" CHECK ("scan_reward_sessions"."request_id"<>'00000000-0000-0000-0000-000000000000'::uuid and "scan_reward_sessions"."fingers" between 1 and 3 and "scan_reward_sessions"."points" between 1 and 1000 and "scan_reward_sessions"."expires_at">"scan_reward_sessions"."created_at" and "scan_reward_sessions"."attempts" between 0 and 3 and "scan_reward_sessions"."status" in ('capture','pending','review','approved','rejected') and ("scan_reward_sessions"."before_id" is null or "scan_reward_sessions"."after_id" is null or "scan_reward_sessions"."before_id"<>"scan_reward_sessions"."after_id"))
);
--> statement-breakpoint
ALTER TABLE "scan_reward_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reward_ledger" DROP CONSTRAINT "ledger_valid";--> statement-breakpoint
ALTER TABLE "reward_image_fingerprints" ADD CONSTRAINT "reward_image_fingerprints_session_id_scan_reward_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."scan_reward_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_reward_sessions" ADD CONSTRAINT "scan_reward_sessions_owner_id_account_access_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_reward_sessions" ADD CONSTRAINT "scan_reward_sessions_barangay_id_barangays_id_fk" FOREIGN KEY ("barangay_id") REFERENCES "public"."barangays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_reward_sessions" ADD CONSTRAINT "scan_reward_sessions_before_id_resident_media_id_fk" FOREIGN KEY ("before_id") REFERENCES "public"."resident_media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_reward_sessions" ADD CONSTRAINT "scan_reward_sessions_after_id_resident_media_id_fk" FOREIGN KEY ("after_id") REFERENCES "public"."resident_media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scan_reward_request" ON "scan_reward_sessions" USING btree ("owner_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scan_reward_before" ON "scan_reward_sessions" USING btree ("before_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scan_reward_after" ON "scan_reward_sessions" USING btree ("after_id");--> statement-breakpoint
CREATE INDEX "scan_reward_owner_order" ON "scan_reward_sessions" USING btree ("owner_id","created_at","id");--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD CONSTRAINT "ledger_valid" CHECK (("reward_ledger"."kind" in ('disposal','scan','cleanup','refund') and "reward_ledger"."amount">0) or ("reward_ledger"."kind"='redemption' and "reward_ledger"."amount"<0));
--> statement-breakpoint
ALTER TABLE "scan_reward_sessions" ADD COLUMN "reviewed_by" uuid;
--> statement-breakpoint
ALTER TABLE "scan_reward_sessions" ADD CONSTRAINT "scan_reward_sessions_reviewed_by_account_access_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;
