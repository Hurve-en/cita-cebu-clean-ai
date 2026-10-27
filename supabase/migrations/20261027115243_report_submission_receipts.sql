-- Source: backend/drizzle/0004_report_submission_receipts.sql
-- Source SHA256: 0e1f990f11d62d67c13761634e359d5bf50a6d08e4817c037e59b6374fd73e13
BEGIN;
SET LOCAL search_path = public, pg_catalog;
CREATE TABLE "report_submission_receipts" (
	"owner_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"report_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_owner_request_pk" PRIMARY KEY("owner_id","request_id"),
	CONSTRAINT "submission_report_unique" UNIQUE("report_id"),
	CONSTRAINT "submission_payload_object" CHECK (jsonb_typeof("report_submission_receipts"."payload") = 'object'),
	CONSTRAINT "submission_request_not_nil" CHECK ("report_submission_receipts"."request_id" <> '00000000-0000-0000-0000-000000000000'::uuid)
);
--> statement-breakpoint
ALTER TABLE "report_submission_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "report_submission_receipts" ADD CONSTRAINT "report_submission_receipts_owner_id_account_access_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."account_access"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_submission_receipts" ADD CONSTRAINT "report_submission_receipts_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE restrict ON UPDATE no action;
COMMIT;
