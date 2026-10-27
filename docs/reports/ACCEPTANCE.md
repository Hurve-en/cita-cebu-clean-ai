# Resident text report submission acceptance

Branch: feat/resident-report-submission
Scope: text reports only. Hosted and device checks below remain pending.

## Apply patch and validate locally

Unzip at the project root, preserving unrelated files. The patch does not replace
.env, auth storage, app config, dependencies or any previously deployed migration.

```bash
npm run typecheck --prefix backend
npm test --prefix backend
npm run db:stage --prefix backend
npx expo lint
npx tsc --noEmit
node --test test/auth.test.cjs test/resident-store.test.cjs test/officer-service.test.cjs test/resident-read.test.cjs test/report-submission.test.cjs
git diff --check
```

Expected: six staged handoffs total, 52 new submission SQL assertions and 71 client
tests total. Only these two deployment migrations are new:

- 20261027115243_report_submission_receipts.sql
- 20261027115510_resident_report_submission.sql

## Hosted deployment (separate guided step)

1. Confirm the intended linked DEVELOPMENT project and the first four migrations
   already applied. Run `npx supabase migration list` and
   `npx supabase db push --dry-run`. Review the output: only the two files above
   should be pending. Stop and investigate any other change or mismatch.
2. After reviewing the dry run, apply using `npx supabase db push` and confirm
   all six local/remote migration identifiers match.
3. In Supabase SQL Editor run the complete `supabase/verify_report_submission.sql`.
   Check each result against the expected values in its comments. These are
   structural checks, not a substitute for signed-in HTTP/device tests.
4. In an authorized development environment run the COMPLETE
   `supabase/tests/report_submission.sql` as an operator. It creates synthetic Auth
   rows inside a transaction solely for SQL authorization testing, injects a
   temporary failure and ends with ROLLBACK. Never execute fragments or manually
   commit it. Do not run on a populated live-user project merely to check a box.
   Re-run verification: both remaining fixture counts must be zero.
5. Review the optional `supabase/configuration/report_categories.sql` labels before
   running it. This persists configuration, unlike the rollback-only tests. Existing
   rows are untouched. Use actual enabled barangays configured by your operator;
   this patch does not invent or seed real communities.
6. Restart Expo with `npx expo start --clear` after deployment/configuration.

The SQL tests simulate JWT claim context within PostgreSQL. They do not test real
Supabase Auth tokens or PostgREST. Complete device checks with real signed-in users.

## Resident device acceptance

- [ ] Home > Report a waste concern opens the connected form. Demo previews retain
      their separate existing behavior and do not call the real RPC.
- [ ] No selected community shows Choose barangay; no configured categories shows
      an honest empty state. Category network failures show retry, not an empty list.
- [ ] Configure/select an enabled community and category. Short title/location,
      missing category and short/blank description cannot produce success.
- [ ] Submit sample non-sensitive text. Success appears only after confirmation.
      My reports and Home refresh; View submitted report opens the saved report.
      Its status is Pending review and it has one initial Report submitted event.
- [ ] Sign out/in and fully close/reopen: the report and activity still load from
      Supabase. This is distinct from the earlier demo-only local record store.
- [ ] Double-tap Submit: one report and one initial event are created.
- [ ] Disconnect before sending; retry after reconnecting. Also simulate a lost
      response AFTER the server commits (development proxy/tool). The same key and
      payload return the same report, with no duplicate report/event/receipt.
- [ ] Fully close during an uncertain submission. Reopen the form under the same
      resident: saved details are locked; Retry confirms the original submission.
      No request is sent just by opening the form.
- [ ] Navigate away while submission is pending, reopen and confirm. Acknowledge
      success; a subsequent new report obtains a new request key.
- [ ] Sign out while submission is delayed; sign in as another resident. No old
      pending text or success state appears in the second account. Sign back into
      the original account to confirm its retained pending submission.
- [ ] Two residents selecting the same barangay still cannot read each other's
      reports/activity. Test foreign IDs through signed-in HTTP and app navigation.
- [ ] Change community after a committed uncertain submission. Confirm the old
      submission safely: it retains its original community. New reports use the
      new selected community. A stale new submission is rejected, never rerouted.
- [ ] Disable a category/community after the form loads: a new write fails honestly.
      A committed retry still confirms; a disabled/unverified account cannot submit
      or confirm. Officer/admin accounts cannot invoke the resident command.
- [ ] Category pagination beyond 20 items works without duplicate choices.
- [ ] Inject storage failure in development: no RPC is sent without a durable retry
      copy. Corrupt pending data is preserved and blocks overwrites. Clearing a
      confirmed retry copy failing never allows a new submission silently.
- [ ] Test keyboard, long labels, multiline text, back navigation, large text and
      screen-reader labels on iOS. Repeat on Android/web before claiming support.
- [ ] Verify no photo picker, fake upload success, points or response-time promise.

## Known boundaries

Local tests and bundle checks do not replace these manual checks. Multi-connection
race tests and real HTTP authorization are still required. Same-key commands are
serialized per resident in PostgreSQL; separate report keys are separate reports.
Concurrent browser tabs can create distinct submissions. Rate limits, abuse review,
retention/erasure and monitoring are future work. Pending text is stored in existing
SQLite/localStorage without additional encryption, retained across logout until
success acknowledgement. Do not submit sensitive personal data during testing.
