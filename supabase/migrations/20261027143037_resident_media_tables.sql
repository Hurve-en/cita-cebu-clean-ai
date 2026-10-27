-- Source: backend/drizzle/0006_resident_media_tables.sql
-- Source SHA256: 16799c73cb76f3f5c5b82016f2cb8568a06bb5ee6428463ea70738311cc5b14d
BEGIN;
SET LOCAL search_path = public, pg_catalog;
CREATE TABLE "resident_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"report_id" uuid,
	"label" text,
	"score" text,
	"model_version" text,
	"byte_size" integer NOT NULL,
	"state" text DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	CONSTRAINT "media_size_valid" CHECK ("resident_media"."byte_size" between 1 and 2097152),
	CONSTRAINT "media_request_valid" CHECK ("resident_media"."request_id" <> '00000000-0000-0000-0000-000000000000'::uuid),
	CONSTRAINT "media_state_valid" CHECK ("resident_media"."state" in ('uploading','ready','delete_pending','deleted')),
	CONSTRAINT "media_ready_valid" CHECK ("resident_media"."state" <> 'ready' or "resident_media"."ready_at" is not null),
	CONSTRAINT "media_shape_valid" CHECK ("resident_media"."state" = 'deleted' or ("resident_media"."kind" = 'report_photo' and "resident_media"."report_id" is not null and "resident_media"."label" is null and "resident_media"."score" is null and "resident_media"."model_version" is null) or ("resident_media"."kind" = 'scan' and "resident_media"."report_id" is null and "resident_media"."label" is not null and "resident_media"."label" in ('glass','metal','non-recyclable','organic','paper','plastic') and "resident_media"."score" is not null and "resident_media"."score" ~ '^(0([.][0-9]{1,8})?|1([.]0{1,8})?)$' and "resident_media"."model_version" is not null and "resident_media"."model_version" = 'mobilenetv2-d0744dc70738-v1'))
);
--> statement-breakpoint
ALTER TABLE "resident_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resident_media" ADD CONSTRAINT "resident_media_owner_id_account_access_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."account_access"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_media" ADD CONSTRAINT "resident_media_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_owner_request" ON "resident_media" USING btree ("owner_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_one_report_photo" ON "resident_media" USING btree ("report_id") WHERE "resident_media"."report_id" is not null and "resident_media"."state" <> 'deleted';--> statement-breakpoint
CREATE INDEX "media_owner_order" ON "resident_media" USING btree ("owner_id","created_at","id");
COMMIT;
