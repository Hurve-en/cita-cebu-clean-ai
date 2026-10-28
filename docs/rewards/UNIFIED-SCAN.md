# Corrected scanner and photo submissions

This correction applies after the previous Unified Scan patch and all fourteen deployed migrations. It restores the pre-unified scanner from the earlier supplied Resident Rewards source. It is a complete overlay of changed files, not a fresh Expo project. Extract from the CebuCleanAI root on your existing branch.

## Scanner

The original camera stage, layout, styles, controls and classification flow are restored. The only added UI is Submit this photo after a result is confirmed saved. Classification already saves the photo and result to account scan history; you can leave the screen and submit that saved photo later. No separate Scan for rewards button or activity selector appears inside the scanner.

## Submission

Submit this photo opens the existing reward-scan route as a form. Rewards → Submit a photo lets you choose a saved scan or a gallery photo. A gallery photo is classified and saved before the form appears. Saving is separate from submitting.

The form asks Independent action or Barangay event, then location and a description of what the resident actually did. Event evidence must refer to a joined cleanup that has started (including completed events). Registration management remains available inside that form for future published events. Saved photos can be submitted later for independent actions and joined events that have already started. Recent joined/completed events are listed; future events must start before evidence is submitted. Earlier photo dates are not treated as evidence of liveness or correctness.

No internet-origin or real-world disposal guarantee is claimed. The bundled model provides only a material suggestion. Both photo sources require officer review before a new independent reward is approved. Photo date/GPS metadata are not used as proof. No private AI verification service or paid API call is necessary for this manual workflow.

## Rewards

The screen displays the current verified points balance, Submit a photo and Refresh points. It does not render the previous overview, daily activity dashboard, catalog or reward-history controls. Existing catalog, redemptions, history, registrations and database records are preserved. New submissions do not add points until authorized review. This patch does not implement the officer/admin live review UI; the protected staff RPCs already exist.

## Existing backend fields and signatures

No new application tables, columns or RPC signatures are added. The existing disposal_claims.after_id becomes optional so one photo can be submitted honestly. The existing claim points constraint accommodates the existing cleanup event range. submit_disposal_claim, review_disposal_claim and review_scan_reward are updated while preserving their signatures and grants. New one-photo submissions reuse start_scan_capture for activity binding and server rate limits, then use the existing durable claim command for submission.

The sole uploaded photo is linked by its existing media ID; it is not duplicated into a pretend after-photo. Single-photo sessions enter manual review and cannot be leased by the vision worker, even when the old automatic-award setting is enabled. Independent claim review and scan review converge on one ledger credit. Event-photo approval requires officer-confirmed completed participation and issues no additional per-photo credit.

## Apply and validate

Unzip the correction into the existing project root. No dependency or native configuration change is introduced. Run the supplied backend typecheck/test/stage, Expo lint, TypeScript and eight client-test commands. Inspect migration list and dry run; the only new migrations are:

- 20261028035601_single_photo_claim.sql
- 20261028035602_manual_photo_submission.sql

All fourteen historical SQL source files, deployment files and mapping entries remain unchanged. Do not alter deployed migrations, reset the database, or run backend local fixture SQL on Supabase.

Before deployment, run this read-only query in the linked project's SQL Editor:

```sql
select column_name,is_nullable
from information_schema.columns
where table_schema='public' and table_name='disposal_claims'
  and column_name='after_id';
```

Expected before this correction: after_id / NO. Expected after deployment: after_id / YES. The earlier preflight_unified_scan.sql belongs to the previous upgrade and should not be rerun as this correction's preflight.

After deployment, inspect the updated verify_unified_scan.sql: existing column/FK/grants and worker permissions must remain correct; the added last query confirms after_id is nullable. Keep the old auto-award configuration unchanged; this new path is manual regardless of that flag.

## Device acceptance

- Confirm the original scanner design is restored, camera/gallery cancellation still works, classification produces a result, and history saving confirms success.
- Use Submit this photo: the same private scan appears before activity/location/details fields.
- Leave a saved photo without submitting, then select it from Rewards → Submit a photo → Choose a saved scan.
- Select a gallery photo: classify first, then show the same form with a manual-review disclosure. Cancellation must keep the previous selection.
- Submit one independent photo. It must produce a pending officer claim and zero immediate points. Same-request retries cannot duplicate it; the same media ID cannot be reused for another claim.
- Restart after a lost acknowledgement. Retry the same request or Retry earlier rewards request. An unresolved request must block a different request from replacing it. Edit unsubmitted details is allowed only when no durable command is pending; old starts still count against rate limits.
- Switch accounts during save/submission. Private photo ownership and pinned tokens must prevent cross-account results.
- Confirm a joined active event can receive a photo, but the larger reward appears only after assigned staff with MFA confirm participation after the event. Photo review must not add a second reward.
- Check keyboard, safe areas and text wrapping on your phone. The source-restoration check does not replace a device screenshot review.

Local Auth/Storage shims do not test hosted JWTs, real uploads, multiple database connections, device behavior or officer UI operation. No production readiness or authenticity guarantee is claimed.
