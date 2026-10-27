# Resident media and scan history acceptance

Branch: feat/resident-media-history
Status: local implementation checks complete; hosted/device checks pending.

## Apply and check

Unzip at the repository root and merge files. No new packages, public environment
variables, native plugins or Auth-storage changes are required. Keep the working .env
and barcode/model/native build configuration. The demo local-record service stays
separate; its tests do not establish live account-media acceptance.

```bash
npm run typecheck --prefix backend
npm test --prefix backend
npm run db:stage --prefix backend
npx expo lint
npx tsc --noEmit
node --test test/auth.test.cjs test/resident-store.test.cjs test/officer-service.test.cjs test/resident-read.test.cjs test/report-submission.test.cjs test/resident-media.test.cjs
git diff --check
```

Expected: 94 client tests, original backend suites plus 52 local media assertions,
eight staged handoffs. Only these two deployment SQL files are new:

- 20261027143037_resident_media_tables.sql
- 20261027143038_resident_media_security.sql

## Hosted setup: guided deployment

1. Confirm the intended development project. Run the COMPLETE read-only
   supabase/preflight_resident_media.sql. New table/policy conflict counts should be
   zero before deployment. An existing bucket is allowed only if its settings match.
2. Run `npx supabase migration list` and `npx supabase db push --dry-run`. The original
   six IDs must match Local/Remote; only the two additions above should be pending.
   Review the output before the actual push.
3. Apply with `npx supabase db push` and verify all eight migration IDs match.
4. Supabase Dashboard > Storage: create a bucket named EXACTLY `resident-media`.
   Keep Public OFF. Configure maximum file size 2 MiB (2097152 bytes), and allowed
   MIME types exactly `image/jpeg`. If it exists, inspect its settings rather than
   creating a second bucket or making it public. Do not add a permissive upload-all
   policy through a dashboard template; the migration already installs policies.
5. Run the COMPLETE read-only supabase/verify_resident_media.sql and inspect every
   result. Expect metadata RLS true, anonymous/DML flags false; five commands allowed
   for authenticated but not anon; seven policies (four restrictive); and one private
   bucket with the exact MIME/byte settings. New uploads fail closed before this setup.
6. Restart `npx expo start --clear`. Use the existing iPhone development build that
   already supports the ONNX classifier. No new native modules were added.

NEVER run backend/test/media-storage-shim.sql in SQL Editor. It mutates fake Storage
metadata exclusively inside the local test database. Hosted uploads/deletes must go
through Storage API so actual object bytes and provider metadata remain consistent.

## Report photo checks

- [ ] Existing text report creation/retry works unchanged. After submission, open its
      details and find Report photo above activity. Add a photo only to an owned report.
- [ ] Gallery cancellation retains a previous selection. Camera denied state provides
      a clear explanation and gallery alternative. Take/cancel/retry on iOS.
- [ ] Foreground Auth refresh after camera/gallery preserves the selected photo and
      returns to the same report. No stale account content appears during revalidation.
- [ ] Preview/remove selection causes no remote upload. Save confirms private photo;
      kill/reopen and sign out/in: the attached photo can still be opened.
- [ ] One photo per report; remove it before adding a different one. Removing a photo
      keeps report text, ownership, original community and activity intact.
- [ ] Toggle airplane mode before and during upload. No false save success. Retry from
      the pending card confirms one reservation/file. Simulate loss AFTER server upload
      and AFTER finalize response; retry must not create another record or overwrite.
- [ ] Kill the app mid-save; return to that report on the same device to retry. On another
      device, an unfinished reservation may be removed but cannot resume absent bytes.
- [ ] Kill/disconnect during removal. Reopen: Finish removal safely removes Storage bytes
      before hiding the metadata. A cancelled request cannot be resurrected by a late retry.
- [ ] Switch accounts mid-save and mid-remove: the next account sees no old preview, URL,
      pending copy or success state. Returning to the original account permits recovery.

## Scanner/history checks

- [ ] A completed supported iOS classification automatically saves a resized photo and
      suggestion. UI says saving until confirmation. Failure retains the result and a
      retry option; never claim the scan was saved just because analysis completed.
- [ ] Open View scan history from scanner and Profile. A saved row opens photo, label,
      model score, guidance, model identity and server save time. Scores do not award points.
- [ ] Fully close/reopen and sign out/in: real saved scans and photos remain available.
- [ ] Analyze the same captured photo again: no accidental duplicate. A different selected
      photo creates its own record. A deleted key cannot silently recreate its old scan.
- [ ] Remove a saved scan and its photo. Repeat after interrupted deletion; no orphaned
      accessible object remains. Existing signed links may remain valid up to 60 seconds.
- [ ] More than 20 controlled scans: Load more preserves ordering and deduplicates page
      boundaries. Failed pagination stays retryable rather than showing a successful empty list.
- [ ] Local pending saves appear even if remote list fetch fails. Recovery is explicit;
      opening history alone does not silently upload queued private photos.
- [ ] At 200 saved/pending scans, creation fails honestly. Old scans remain. Remove an old
      scan, then retry. Cancelling the locally queued rejected scan also works at full quota.
- [ ] Five pending upload reservations prevent further reservations until resolved/cancelled.
      The client does not create unbounded new keys to bypass a failed save.
- [ ] Corrupt/missing local data, full device/browser storage and provider upload errors
      produce visible errors, preserve recovery evidence and never show false save success.

## Hosted authorization / provider behavior

Use two real resident sessions and authorized development test data, never a service
key inside Expo. These checks cannot be replaced with SQL Editor running as postgres.

- [ ] Resident B cannot read A's resident_media rows, open A's direct record ID, mint a
      signed URL for A's object, upload to A's path, finalize A's row or remove A's file.
- [ ] Anonymous public URL cannot retrieve bytes from resident-media. Anonymous RPC and
      metadata access fail. Disabled/unverified/staff sessions cannot run resident commands.
- [ ] Real Storage uploads write owner_id and metadata.size/mimetype matching expected
      values; successful upload followed by finalize works without privileged client code.
- [ ] Uploading oversized/unsupported-MIME data through actual Storage API is rejected.
      No upsert, overwrite, move into/out of this bucket or ready-object direct delete works.
- [ ] Use concurrent real requests to exercise same-key prepares, prepare-vs-cancel,
      upload metadata commit-vs-removal and finalize-vs-removal. Confirm one live result
      and recoverable states; local PGlite is single connection and cannot prove these races.
- [ ] Signed links expire. Refresh photo obtains a new link under the current owner's
      token. Raw signed URLs are not logged, stored in local manifests or sent in analytics.
- [ ] Test report camera/gallery, history, large text, keyboard, navigation, safe areas and
      screen reader behavior on iOS; repeat applicable flows on Android/web. The existing
      classifier remains iOS-only and must fail honestly on unsupported platforms.

## Limits to retain in PR

No hosted acceptance is claimed until performed. Server-side binary image validation,
malware/content moderation, reward verification, automatic abandoned-object cleanup,
account erasure, production abuse controls and staff photo access remain future work.
Native/IndexedDB pending photos have no extra application encryption and survive logout
for recovery. Unsubmitted selections and pre-manifest crashes are not guaranteed drafts.
