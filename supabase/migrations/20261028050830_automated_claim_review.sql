-- Source: backend/drizzle/0016_automated_claim_review.sql
-- Source SHA256: 579ac74e318fcc78d883bdc42d1172504df2b3460dbea31a3cfc7adcaaddd9d5
BEGIN;
SET LOCAL search_path = public, pg_catalog;
ALTER TABLE "disposal_claims" DROP CONSTRAINT "claim_valid";--> statement-breakpoint
ALTER TABLE "disposal_claims" ADD CONSTRAINT "claim_valid" CHECK (("disposal_claims"."after_id" is null or "disposal_claims"."before_id"<>"disposal_claims"."after_id") and "disposal_claims"."request_id"<>'00000000-0000-0000-0000-000000000000'::uuid and char_length("disposal_claims"."location") between 3 and 200 and char_length("disposal_claims"."description") between 10 and 2000 and "disposal_claims"."points" between 1 and 10000 and "disposal_claims"."status" in ('pending','approved','rejected') and char_length("disposal_claims"."review_note")<=1000 and (("disposal_claims"."status"='pending' and "disposal_claims"."reviewed_by" is null and "disposal_claims"."reviewed_at" is null) or ("disposal_claims"."status"<>'pending' and "disposal_claims"."reviewed_at" is not null and char_length("disposal_claims"."review_note")>=8)));
COMMIT;
