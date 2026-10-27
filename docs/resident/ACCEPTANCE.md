# Resident data integration acceptance

Branch: feat/resident-data-integration. Hosted and device checks below are pending.

## Install and local checks

Merge the ZIP files into the repository root, preserving files absent from the patch.
Do not copy backend/docs/supabase under src. Do not replace whole directories.
No dependencies, migrations, public keys, SMTP settings or native modules change here.
Keep the working Auth environment and platform storage files from your project.

Run:

```bash
npx expo lint
npx tsc --noEmit
node --test test/auth.test.cjs test/resident-store.test.cjs test/officer-service.test.cjs test/resident-read.test.cjs
npx expo start --clear
```

Root checks and all 54 tests passed in the implementation environment. Exports check JS
bundles, not actual installation or device behavior. The existing app config references a
missing assets/images/branding/app-icon.png and can warn during web export.

## Manual checks

- [ ] Sign in as the resident already verified in the Auth branch. It now reaches the
      five-tab home rather than the separate account-only workspace.
- [ ] Confirm Home/Profile show the real display name and account email, without demo
      points, sample reports, sample schedules or demo badges.
- [ ] With no selected barangay, show the choose-community state. With no configured
      enabled barangays, show the empty choice list and allow choosing later.
- [ ] Change the display name through Profile > Account details. Sign out and sign back
      in; the update persists. Another session's competing update produces an honest
      conflict/reload path, not a false success.
- [ ] Select an enabled community and confirm its published schedules load. Change the
      selection and confirm old schedules disappear while the new scope loads.
- [ ] Using controlled DEVELOPMENT fixtures, verify own published schedules are shown,
      foreign/draft/archived schedules do not appear, and direct unavailable IDs show an
      unavailable state. No fixture is automatically created by this patch.
- [ ] Empty published schedules show an empty state, not a sample-week fallback.
- [ ] Reports show only the signed-in resident's records. A second resident cannot open
      the first resident's report ID even if both select the same community.
- [ ] A report retained from a previous selected community remains visible to its owner.
- [ ] Report detail shows the current status and resident-visible activity only. Test a
      report with an internal note; no note content or actor ID is returned/displayed.
- [ ] Test more than 20 records/events with reviewed development fixtures. Load-more
      pages preserve stable ordering, remove duplicate boundaries and support retries.
- [ ] Disable connectivity and refresh each resource. Show error/retry; reconnect and
      retry successfully. A failed request does not look like a successful empty read.
- [ ] Sign out during a delayed request. Sign in as another resident; no old profile,
      report, schedule, detail or scan photo appears for the new account.
- [ ] Foreground the app and manually check account access. Current eligibility is
      rechecked; disabled/nonresident accounts cannot continue in the resident tabs.
- [ ] Fully close and reopen while signed in. Auth restoration still works and returns
      to resident home. This patch does not change the working storage adapter.
- [ ] Camera permissions, capture, photo picker cancellation, classification, retry and
      returning from the gallery work on iOS. Foreground Auth checks do not discard the
      selected photo. Test switching accounts during analysis as well.
- [ ] Real scan results clearly say account history is unavailable. They do not invoke
      the demo save service, show save success, offer retry-save or award points.
- [ ] Rewards show unavailable with no sample balance or demo redemption.
- [ ] New report/history/reminder/notification URLs cannot open demo mutation forms in a
      real account. Report submission and photo attachments remain unavailable.
- [ ] Signed-out development previews still work with their original isolated state.
- [ ] Repeat on Android/web. Check keyboard, large text, back navigation and screen-reader
      labels. Do not treat an export as Android/web device acceptance.

Positive-data and isolation checks require authorized development fixtures or later real
write workflows. Empty production tables do not prove positive-data isolation. Do not
create records in a live user environment merely to tick these checks. Record what was
actually tested in the PR, and leave untested items pending.
