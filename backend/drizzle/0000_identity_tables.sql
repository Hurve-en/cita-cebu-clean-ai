CREATE TYPE "public"."cebu_provisioning_state" AS ENUM('pending', 'ready');--> statement-breakpoint
CREATE TYPE "public"."cebu_role" AS ENUM('resident', 'officer', 'admin');--> statement-breakpoint
CREATE TABLE "account_access" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"product_role" "cebu_role" DEFAULT 'resident' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"provisioning_state" "cebu_provisioning_state" DEFAULT 'ready' NOT NULL,
	"access_version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_version_positive" CHECK ("account_access"."access_version" > 0),
	CONSTRAINT "pending_accounts_disabled" CHECK ("account_access"."provisioning_state" <> 'pending' or not "account_access"."enabled")
);
--> statement-breakpoint
ALTER TABLE "account_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "barangays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barangays_name_unique" UNIQUE("name"),
	CONSTRAINT "barangays_name_valid" CHECK ("barangays"."name" = btrim("barangays"."name") and char_length("barangays"."name") between 2 and 100)
);
--> statement-breakpoint
ALTER TABLE "barangays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "officer_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"officer_id" uuid NOT NULL,
	"barangay_id" uuid NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	CONSTRAINT "assignment_window_valid" CHECK ("officer_assignments"."effective_to" is null or "officer_assignments"."effective_to" >= "officer_assignments"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "officer_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"resident_barangay_id" uuid,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_name_valid" CHECK ("profiles"."display_name" = btrim("profiles"."display_name") and char_length("profiles"."display_name") between 2 and 80),
	CONSTRAINT "profiles_version_positive" CHECK ("profiles"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account_access" ADD CONSTRAINT "account_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officer_assignments" ADD CONSTRAINT "officer_assignments_officer_id_account_access_user_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."account_access"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officer_assignments" ADD CONSTRAINT "officer_assignments_barangay_id_barangays_id_fk" FOREIGN KEY ("barangay_id") REFERENCES "public"."barangays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_resident_barangay_id_barangays_id_fk" FOREIGN KEY ("resident_barangay_id") REFERENCES "public"."barangays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "officer_one_current_assignment" ON "officer_assignments" USING btree ("officer_id") WHERE "officer_assignments"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "current_officers_by_barangay" ON "officer_assignments" USING btree ("barangay_id","officer_id") WHERE "officer_assignments"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "profiles_selected_barangay" ON "profiles" USING btree ("resident_barangay_id");