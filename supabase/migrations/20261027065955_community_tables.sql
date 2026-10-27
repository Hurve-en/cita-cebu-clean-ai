-- Source: backend/drizzle/0002_community_tables.sql
-- Source SHA256: d93aceb6d38cc317d978bee9f9b58db3612b56a1ca284beb0ea063d54734dab2
BEGIN;
SET LOCAL search_path = public, pg_catalog;
CREATE TYPE "public"."report_event_type" AS ENUM('created', 'status_changed', 'internal_note');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending_review', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."report_visibility" AS ENUM('resident', 'internal');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."waste_stream" AS ENUM('recyclables', 'organic', 'residual');--> statement-breakpoint
CREATE TABLE "collection_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barangay_id" uuid NOT NULL,
	"title" text NOT NULL,
	"stream" "waste_stream" NOT NULL,
	"weekdays" integer[] NOT NULL,
	"start_time" time(0) NOT NULL,
	"end_time" time(0) NOT NULL,
	"timezone" text DEFAULT 'Asia/Manila' NOT NULL,
	"area" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"status" "schedule_status" DEFAULT 'draft' NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_title_valid" CHECK ("collection_schedules"."title" = btrim("collection_schedules"."title") and char_length("collection_schedules"."title") between 3 and 80),
	CONSTRAINT "schedule_area_valid" CHECK ("collection_schedules"."area" = btrim("collection_schedules"."area") and char_length("collection_schedules"."area") between 3 and 150),
	CONSTRAINT "schedule_instructions_valid" CHECK (char_length("collection_schedules"."instructions") <= 1000),
	CONSTRAINT "schedule_version_positive" CHECK ("collection_schedules"."version" > 0),
	CONSTRAINT "schedule_timezone_valid" CHECK ("collection_schedules"."timezone" = 'Asia/Manila'),
	CONSTRAINT "schedule_time_window_valid" CHECK ("collection_schedules"."start_time" < "collection_schedules"."end_time"
    and "collection_schedules"."end_time" < time '24:00' and extract(second from "collection_schedules"."start_time") = 0
    and extract(second from "collection_schedules"."end_time") = 0),
	CONSTRAINT "schedule_weekdays_valid" CHECK (cardinality("collection_schedules"."weekdays") between 1 and 7
    and array_ndims("collection_schedules"."weekdays") = 1 and array_lower("collection_schedules"."weekdays", 1) = 1
    and "collection_schedules"."weekdays" <@ array[1,2,3,4,5,6,7]::integer[]
    and array_position("collection_schedules"."weekdays", null) is null
    and (cardinality("collection_schedules"."weekdays") < 2 or "collection_schedules"."weekdays"[1] < "collection_schedules"."weekdays"[2])
    and (cardinality("collection_schedules"."weekdays") < 3 or "collection_schedules"."weekdays"[2] < "collection_schedules"."weekdays"[3])
    and (cardinality("collection_schedules"."weekdays") < 4 or "collection_schedules"."weekdays"[3] < "collection_schedules"."weekdays"[4])
    and (cardinality("collection_schedules"."weekdays") < 5 or "collection_schedules"."weekdays"[4] < "collection_schedules"."weekdays"[5])
    and (cardinality("collection_schedules"."weekdays") < 6 or "collection_schedules"."weekdays"[5] < "collection_schedules"."weekdays"[6])
    and (cardinality("collection_schedules"."weekdays") < 7 or "collection_schedules"."weekdays"[6] < "collection_schedules"."weekdays"[7]))
);
--> statement-breakpoint
ALTER TABLE "collection_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "report_categories" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "category_code_valid" CHECK ("report_categories"."code" ~ '^[a-z][a-z0-9_]{1,49}$'),
	CONSTRAINT "category_label_valid" CHECK ("report_categories"."label" = btrim("report_categories"."label") and char_length("report_categories"."label") between 2 and 80)
);
--> statement-breakpoint
ALTER TABLE "report_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "report_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"event_type" "report_event_type" NOT NULL,
	"previous_status" "report_status",
	"next_status" "report_status",
	"visibility" "report_visibility" NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_note_valid" CHECK ("report_events"."note" = btrim("report_events"."note") and char_length("report_events"."note") <= 1000),
	CONSTRAINT "event_shape_valid" CHECK ((
    "report_events"."event_type" = 'created' and "report_events"."visibility" = 'resident'
    and "report_events"."previous_status" is null and "report_events"."next_status" is not null and "report_events"."next_status" = 'pending_review'
  ) or (
    "report_events"."event_type" = 'internal_note' and "report_events"."visibility" = 'internal'
    and "report_events"."previous_status" is null and "report_events"."next_status" is null and char_length("report_events"."note") >= 1
  ) or (
    "report_events"."event_type" = 'status_changed' and "report_events"."visibility" = 'resident'
    and "report_events"."previous_status" is not null and "report_events"."next_status" is not null
    and (("report_events"."previous_status" = 'pending_review' and "report_events"."next_status" in ('in_progress','resolved'))
      or ("report_events"."previous_status" = 'in_progress' and "report_events"."next_status" = 'resolved')
      or ("report_events"."previous_status" = 'resolved' and "report_events"."next_status" = 'in_progress'))
    and (("report_events"."next_status" <> 'resolved' and "report_events"."previous_status" <> 'resolved') or char_length("report_events"."note") >= 8)
  ))
);
--> statement-breakpoint
ALTER TABLE "report_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"original_barangay_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category_code" text NOT NULL,
	"location_text" text NOT NULL,
	"description" text NOT NULL,
	"status" "report_status" DEFAULT 'pending_review' NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_title_valid" CHECK ("reports"."title" = btrim("reports"."title") and char_length("reports"."title") between 3 and 120),
	CONSTRAINT "report_location_valid" CHECK ("reports"."location_text" = btrim("reports"."location_text") and char_length("reports"."location_text") between 3 and 200),
	CONSTRAINT "report_description_valid" CHECK ("reports"."description" = btrim("reports"."description") and char_length("reports"."description") between 10 and 2000),
	CONSTRAINT "report_version_positive" CHECK ("reports"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collection_schedules" ADD CONSTRAINT "collection_schedules_barangay_id_barangays_id_fk" FOREIGN KEY ("barangay_id") REFERENCES "public"."barangays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_schedules" ADD CONSTRAINT "collection_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_schedules" ADD CONSTRAINT "collection_schedules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_events" ADD CONSTRAINT "report_events_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_events" ADD CONSTRAINT "report_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_original_barangay_id_barangays_id_fk" FOREIGN KEY ("original_barangay_id") REFERENCES "public"."barangays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_category_code_report_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "public"."report_categories"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedules_community_status_order" ON "collection_schedules" USING btree ("barangay_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "report_events_report_order" ON "report_events" USING btree ("report_id","created_at","id");--> statement-breakpoint
CREATE INDEX "report_events_actor" ON "report_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "reports_owner_order" ON "reports" USING btree ("owner_id","created_at","id");--> statement-breakpoint
CREATE INDEX "reports_community_status_order" ON "reports" USING btree ("original_barangay_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "reports_category" ON "reports" USING btree ("category_code");
COMMIT;
