CREATE TABLE "cleanup_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barangay_id" uuid NOT NULL,
	"title" text NOT NULL,
	"location" text NOT NULL,
	"instructions" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"points" integer NOT NULL,
	"capacity" integer NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cleanup_event_valid" CHECK (char_length("cleanup_events"."title") between 3 and 100 and char_length("cleanup_events"."location") between 3 and 200 and char_length("cleanup_events"."instructions") between 10 and 2000 and "cleanup_events"."ends_at">"cleanup_events"."starts_at" and "cleanup_events"."points" between 2 and 10000 and "cleanup_events"."capacity" between 1 and 10000 and "cleanup_events"."status" in ('published','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "cleanup_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cleanup_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" text DEFAULT 'joined' NOT NULL,
	"review_note" text DEFAULT '' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_valid" CHECK ("cleanup_participants"."status" in ('joined','completed','rejected','cancelled') and char_length("cleanup_participants"."review_note")<=1000 and (("cleanup_participants"."status" in ('joined','cancelled') and "cleanup_participants"."reviewed_by" is null and "cleanup_participants"."reviewed_at" is null) or ("cleanup_participants"."status" not in ('joined','cancelled') and "cleanup_participants"."reviewed_by" is not null and "cleanup_participants"."reviewed_at" is not null and char_length("cleanup_participants"."review_note")>=8)))
);
--> statement-breakpoint
ALTER TABLE "cleanup_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "disposal_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"barangay_id" uuid NOT NULL,
	"before_id" uuid NOT NULL,
	"after_id" uuid NOT NULL,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"points" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text DEFAULT '' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_valid" CHECK ("disposal_claims"."before_id"<>"disposal_claims"."after_id" and "disposal_claims"."request_id"<>'00000000-0000-0000-0000-000000000000'::uuid and char_length("disposal_claims"."location") between 3 and 200 and char_length("disposal_claims"."description") between 10 and 2000 and "disposal_claims"."points" between 1 and 1000 and "disposal_claims"."status" in ('pending','approved','rejected') and char_length("disposal_claims"."review_note")<=1000 and (("disposal_claims"."status"='pending' and "disposal_claims"."reviewed_by" is null and "disposal_claims"."reviewed_at" is null) or ("disposal_claims"."status"<>'pending' and "disposal_claims"."reviewed_by" is not null and "disposal_claims"."reviewed_at" is not null and char_length("disposal_claims"."review_note")>=8)))
);
--> statement-breakpoint
ALTER TABLE "disposal_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reward_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"cost" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reward_catalog_valid" CHECK (char_length("reward_catalog"."name") between 3 and 100 and char_length("reward_catalog"."description") between 10 and 1000 and "reward_catalog"."cost" between 1 and 1000000 and "reward_catalog"."stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "reward_catalog" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reward_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"kind" text NOT NULL,
	"source_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_valid" CHECK (("reward_ledger"."kind" in ('disposal','cleanup','refund') and "reward_ledger"."amount">0) or ("reward_ledger"."kind"='redemption' and "reward_ledger"."amount"<0))
);
--> statement-breakpoint
ALTER TABLE "reward_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reward_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"barangay_id" uuid NOT NULL,
	"reward_name" text NOT NULL,
	"cost" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text DEFAULT '' NOT NULL,
	"fulfilled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redemption_valid" CHECK ("reward_redemptions"."cost">0 and "reward_redemptions"."request_id"<>'00000000-0000-0000-0000-000000000000'::uuid and "reward_redemptions"."status" in ('pending','fulfilled','cancelled') and char_length("reward_redemptions"."review_note")<=1000)
);
--> statement-breakpoint
ALTER TABLE "reward_redemptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reward_rules" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"disposal_points" integer DEFAULT 10 NOT NULL,
	"cleanup_points" integer DEFAULT 50 NOT NULL,
	"daily_claim_limit" integer DEFAULT 3 NOT NULL,
	CONSTRAINT "reward_rules_valid" CHECK ("reward_rules"."id"=1 and "reward_rules"."disposal_points" between 1 and 1000 and "reward_rules"."cleanup_points" > "reward_rules"."disposal_points" and "reward_rules"."cleanup_points" <= 10000 and "reward_rules"."daily_claim_limit" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "reward_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resident_media" DROP CONSTRAINT "media_shape_valid";--> statement-breakpoint
ALTER TABLE "cleanup_events" ADD CONSTRAINT "cleanup_events_barangay_id_barangays_id_fk" FOREIGN KEY ("barangay_id") REFERENCES "public"."barangays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleanup_events" ADD CONSTRAINT "cleanup_events_created_by_account_access_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleanup_participants" ADD CONSTRAINT "cleanup_participants_owner_id_account_access_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleanup_participants" ADD CONSTRAINT "cleanup_participants_event_id_cleanup_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."cleanup_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleanup_participants" ADD CONSTRAINT "cleanup_participants_reviewed_by_account_access_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disposal_claims" ADD CONSTRAINT "disposal_claims_owner_id_account_access_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disposal_claims" ADD CONSTRAINT "disposal_claims_barangay_id_barangays_id_fk" FOREIGN KEY ("barangay_id") REFERENCES "public"."barangays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disposal_claims" ADD CONSTRAINT "disposal_claims_before_id_resident_media_id_fk" FOREIGN KEY ("before_id") REFERENCES "public"."resident_media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disposal_claims" ADD CONSTRAINT "disposal_claims_after_id_resident_media_id_fk" FOREIGN KEY ("after_id") REFERENCES "public"."resident_media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disposal_claims" ADD CONSTRAINT "disposal_claims_reviewed_by_account_access_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD CONSTRAINT "reward_ledger_owner_id_account_access_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD CONSTRAINT "reward_ledger_actor_id_account_access_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_owner_id_account_access_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_id_reward_catalog_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."reward_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_barangay_id_barangays_id_fk" FOREIGN KEY ("barangay_id") REFERENCES "public"."barangays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_fulfilled_by_account_access_user_id_fk" FOREIGN KEY ("fulfilled_by") REFERENCES "public"."account_access"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cleanup_community_order" ON "cleanup_events" USING btree ("barangay_id","starts_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "cleanup_once_per_resident" ON "cleanup_participants" USING btree ("owner_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_owner_request" ON "disposal_claims" USING btree ("owner_id","request_id");--> statement-breakpoint
CREATE INDEX "claim_owner_order" ON "disposal_claims" USING btree ("owner_id","created_at","id");--> statement-breakpoint
CREATE INDEX "claim_community_status" ON "disposal_claims" USING btree ("barangay_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_source_once" ON "reward_ledger" USING btree ("kind","source_id");--> statement-breakpoint
CREATE INDEX "ledger_owner_order" ON "reward_ledger" USING btree ("owner_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_owner_request" ON "reward_redemptions" USING btree ("owner_id","request_id");--> statement-breakpoint
CREATE INDEX "redemption_owner_order" ON "reward_redemptions" USING btree ("owner_id","created_at","id");--> statement-breakpoint
ALTER TABLE "resident_media" ADD CONSTRAINT "media_shape_valid" CHECK ("resident_media"."state" = 'deleted' or ("resident_media"."kind" = 'disposal_photo' and "resident_media"."report_id" is null and "resident_media"."label" is null and "resident_media"."score" is null and "resident_media"."model_version" is null) or ("resident_media"."kind" = 'report_photo' and "resident_media"."report_id" is not null and "resident_media"."label" is null and "resident_media"."score" is null and "resident_media"."model_version" is null) or ("resident_media"."kind" = 'scan' and "resident_media"."report_id" is null and "resident_media"."label" is not null and "resident_media"."label" in ('glass','metal','non-recyclable','organic','paper','plastic') and "resident_media"."score" is not null and "resident_media"."score" ~ '^(0([.][0-9]{1,8})?|1([.]0{1,8})?)$' and "resident_media"."model_version" is not null and "resident_media"."model_version" = 'mobilenetv2-d0744dc70738-v1'));