# Rewards acceptance checklist

Status: automated local checks executed; hosted/device checks remain to be recorded by the project owner.

## Deployment

- [ ] Run the read-only preflight before deployment; inspect all results.
- [ ] Preview exactly the two Part 7 migrations; keep all eight historical files unchanged.
- [ ] Apply migrations through Supabase CLI; all ten Local/Remote entries match.
- [ ] Inspect every query in `supabase/verify_rewards.sql`.
- [ ] Confirm private bucket settings and previous media/report flows still work.

## Resident earning flow

- [ ] New resident sees a genuine zero balance, not demo/sample points.
- [ ] Independent disposal clearly has a smaller award than new organized cleanup events.
- [ ] Missing barangay blocks claims and redemption with a useful explanation.
- [ ] Capture/gallery cancellation keeps the previous selection and does not upload by itself.
- [ ] Before and after previews stay visible after the iOS picker/foreground Auth refresh.
- [ ] Explicitly saving each evidence photo uses private upload/finalization and can be retried after disconnection.
- [ ] Pending photo uploads remain discoverable after app restart; cancelled uploads do not resurrect.
- [ ] Submit two different saved photos and a location/description; confirmation says pending review and awards zero points.
- [ ] Restart/logout/login: claim and its status remain; another resident cannot read it.
- [ ] Reusing either claimed photo under a new key is rejected; claimed photos leave the unused library.
- [ ] Submitted evidence cannot be removed while retained for audit; unused evidence can be removed.
- [ ] Daily submission limit follows Philippine calendar dates; rejected claims still count toward that day's submission limit.
- [ ] Scanning still provides guidance/history and does not mint reward points.

## Cleanup registration

- [ ] Empty list is honest when no real events are published.
- [ ] Published event shows location, time, instructions and fixed points.
- [ ] Only eligible community events can be joined before the start and within capacity.
- [ ] Retry joining produces one registration; registration awards zero points.
- [ ] Withdraw before start; retry withdrawal is safe; capacity is released; rejoin reuses the same record.
- [ ] After a barangay change, joined event history remains accessible but unrelated community events do not leak.

## Staff verification dependencies

These are backend RPCs in this ZIP. Live officer/admin screens and account provisioning are NOT completed by this branch. Verify with actual authenticated staff sessions once those workflows are connected; do not substitute operator SQL impersonation for device acceptance.

- [ ] Assigned officer/administrator with MFA can review submitted evidence and add a meaningful approval/rejection explanation.
- [ ] Unassigned officer, aal1 session, disabled account and self-review cannot approve a claim or participation.
- [ ] Independent approval credits its snapshotted smaller amount exactly once; rejection credits zero.
- [ ] Participation cannot be verified before the cleanup ends; completion credits its fixed larger award exactly once.
- [ ] Reviewers cannot read unused evidence, ordinary scan photos or evidence outside their authorized community.
- [ ] Disabled or no-longer-resident recipients cannot receive new review-based awards.

## Catalog and redemption

- [ ] Operators approve point rules, actual funded stock and pickup procedures before enabling real rewards.
- [ ] Catalog empty/out-of-stock/error/loading states are distinct; no invented stock or balance is shown.
- [ ] One reservation checks current stock, price, community and balance on the server.
- [ ] Price change, insufficient balance, inactive community and sold-out stock are rejected atomically.
- [ ] Double taps, lost responses, restart and explicit retry create one reservation and one debit.
- [ ] Owner cancellation refunds/restores stock once; another account cannot cancel it.
- [ ] Staff fulfillment records an attributed pickup explanation; fulfilled goods cannot be refunded and cancelled reservations cannot be fulfilled.
- [ ] Activity pages paginate without duplicates and failed pages remain retryable.
- [ ] With multiple real connections, simultaneously redeem the last stock unit from two funded accounts; only one succeeds.
- [ ] With multiple connections, simultaneously redeem against one account balance; no overdraft occurs.
- [ ] Test cancellation versus fulfillment, approval versus replay, and evidence submission versus deletion races.

## Operational readiness still required

Do not call the rewards program production-ready from local tests alone. Complete funded catalog approval, staff integration, hosted contention testing, monitoring, moderation/appeals, retention/account deletion policy and an award-reversal workflow before a public launch. Photo IDs prevent record reuse, not re-uploaded-image fraud or proof-of-disposal forgery.
