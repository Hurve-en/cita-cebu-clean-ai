# History navigation and pending deletion update

Apply after the History / Rewards Completion ZIP and its eighteen deployed migrations. Only this update's changed files are included. No dependency or scanner-design change is required.

## Changes

- Live History Reports has a fixed bottom Back button. It is outside the scrolling list and respects the existing bottom safe area. The demo history Back action is also at the bottom of its content.
- Newer / Older are replaced by Previous page / Next page. A direction is shown only when a page exists in that direction. If all entries fit on one page, both controls and the page explanation are hidden. Twenty-item server pagination and bounded page memory remain; moving pages returns the list to the top.
- An independent scan waiting for its AI check has Delete pending photo in History Reports and saved-photo details. A confirmation explains that deletion cancels the check, deletes the image and does not restore the daily submission allowance.
- The backend invalidates an in-flight worker lease before permitting image deletion. If approval wins the race first, removal is refused and the award is preserved; if withdrawal wins, an old verdict is rejected. Current tests exercise the serialized outcomes and stale leases. Real multi-connection contention is UNVERIFIED.
- Deletion uses the existing begin / Storage API remove / finish protocol. No fake success is shown while bytes remain. A failed delete remains visible as Deletion unfinished with Retry deleting photo. Successful completion removes the item from history and scrubs the existing media fields through the existing finalize function.
- Withdrawal keeps the existing claim/session/media tombstone rows, including submission metadata, for request idempotency and daily limits. It is not a complete account-data erasure endpoint. The actual Storage image is removed. Matching local form/retry data is cleared only after confirmed image deletion; unrelated, foreign and damaged local data is preserved.
- Approved evidence, ordinary rejected evidence, barangay-event evidence, the scanner design and the Rewards screen are unchanged by this patch.

## NEW endpoint; no new database fields

**NEW:** `public.withdraw_pending_scan(p_media_id uuid) RETURNS public.resident_media`.

Only an eligible authenticated resident can withdraw their own pending single-photo independent submission. No owner, role, amount or verdict is accepted from the app. Direct table/ledger writes remain closed. The endpoint returns the existing media row in delete_pending (or deleted on a completed retry). The client must then complete the existing Storage deletion protocol.

**NEW private helper:** `cebu_private.is_withdrawn_scan(uuid)`. It recognizes a server-authored withdrawal across matching owner/session/claim records, rejects awarded or multiply linked evidence, and is not executable by client roles. It narrowly allows the existing evidence-retention trigger to permit final removal of withdrawn photos. It does not relax retention for other submissions.

**No new table, database column or status enum.** The existing verifier field stores the operational marker `resident-withdrawal-v1`; existing rejected status and review-note fields record withdrawal. History displays this as unfinished deletion while cleanup is pending, not as an AI rejection. The marker does not claim an AI model performed the withdrawal.

The new custom Drizzle migration is `0018_pending_scan_removal.sql`, staged as `20261028055350_pending_scan_removal.sql`. The first eighteen deployed migrations must remain unchanged.

## Install and check

From the project root:

```bash
unzip -o ~/Downloads/CebuCleanAI-History-Navigation-Delete-Fix.zip -d .
npm run typecheck --prefix backend
npm test --prefix backend
npm run db:stage --prefix backend
npx expo lint
npx tsc --noEmit
node --test test/*.test.cjs
git diff --check
npx supabase migration list
npx supabase db push --dry-run
```

The dry run should list only `20261028055350_pending_scan_removal.sql`. Then apply it through the usual CLI confirmation and confirm Local/Remote match:

```bash
npx supabase db push
npx supabase migration list
npx expo start --clear
```

Do not run backend/test/history-local.sql in hosted Supabase: it uses local synthetic Auth/Storage fixtures.

## Phone acceptance

1. History Back stays reachable at the bottom while scrolling. With twenty or fewer entries, no unavailable page buttons appear.
2. With more than twenty test entries, Next page and Previous page change the records and scroll back to the top.
3. Delete an AI-check-pending independent photo. Confirm it disappears and no points appear. Verify the original image is removed from private Storage, not merely hidden.
4. Interrupt deletion after withdrawal or during Storage removal; refresh History and retry the unfinished deletion. It must not submit another claim or award points.
5. Try a verified or event item: its existing retention and event process remain unchanged.
6. Reopen the scanner and saved-photo submission flow: no design or capture changes should appear.

These phone checks and real hosted byte-deletion races remain UNVERIFIED until run on the user's project/device. Automatic AI activation remains a separate acceptance item; this update does not enable it.

## Recorded local validation

- Expo lint: passed, zero code errors/warnings.
- Frontend/backend TypeScript: passed.
- Client tests: 136 passed, zero failed.
- Full backend suite: passed, including new pending-withdrawal, stale-lease, Storage deletion, replay and retained-limit assertions.
- Migration staging: 19 handoffs validated; first eighteen deployed sources/mappings unchanged.
- iOS/web exports: succeeded.
- Scanner source and Rewards screen: no edits in this patch.

After deployment, `supabase/verify_pending_scan_removal.sql` returns one read-only row. Expected: resident_withdrawal=true, anonymous_withdrawal=false, client_private_helper=false, client_verifier=false.
