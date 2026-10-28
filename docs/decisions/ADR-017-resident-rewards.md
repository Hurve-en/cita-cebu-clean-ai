# ADR-017: Verified disposal and cleanup rewards

Status: implemented locally; hosted deployment and acceptance pending.

## Product decision

Residents can earn without joining a barangay cleanup. Independent correct disposal receives a smaller award; verified participation in an organized cleanup receives a larger award. Both credit the same verified points balance. Scanning never awards redeemable points.

Initial configurable defaults are 10 points per approved independent claim, 50 points per verified cleanup participation, and 3 independent submissions per Philippine calendar day. These are implementation defaults, not a promise of funded rewards. Operators must approve the launch rules and fund stock before publishing the catalog. The database enforces cleanup_points > disposal_points in the rules row. Claims and events snapshot their award at creation, so later rule changes do not rewrite existing promises.

## Independent disposal

A resident saves two distinct private `disposal_photo` records through the existing Part 6 reservation, byte upload and finalization protocol. No classifier label is invented for evidence photos. The resident submits the two IDs, location, description, expected barangay and a durable idempotency key.

The database derives identity, current active community and award. It locks the resident account and evidence in a stable order, rejects foreign/unready photos, duplicate photo use (including swapped roles), changed retry payloads and excess daily claims. A claim is pending and contributes zero spendable points until an assigned eligible officer or administrator, with aal2, approves it and records a meaningful explanation. Rejection awards zero. A review cannot silently be changed after a decision.

Submitted photos are locked against resident deletion and retained for review/audit. Unsubmitted photos remain removable. The unused-photo view excludes claimed evidence, and retained evidence does not consume the unused-upload quota of 60. This is not an automatic retention/deletion policy: a governed retention workflow is still required before broad production launch. Existing short-lived signed links remain bearer capabilities until expiry.

## Cleanup participation

Authorized staff create events for their assigned active community. New events snapshot the larger rule award. Residents register for their current barangay before the start time; capacity is checked under an event row lock. Joining/rejoining is unique per resident/event. Residents may withdraw before the start and later rejoin if capacity remains.

After the event ends, staff verify completed participation or reject it with an explanation. Registration alone awards nothing. Completion credits once. Residents cannot verify themselves. This branch supplies secured staff RPCs; officer/admin review, event management and fulfillment UI integration remain separate work.

## Points, redemption and fulfillment

`reward_ledger` is the source of truth. Clients cannot write balances, ledger entries, awards, stock, roles or review states directly. Credit, redemption and cancellation RPCs serialize on the recipient account row. A redemption also locks catalog stock, checks its server price against the displayed expected cost, checks the derived balance, snapshots the reward name/cost/community, debits points and reserves one unit atomically.

A pending redemption may be cancelled by its owner; the refund and stock restoration happen once. Fulfillment requires assigned staff with aal2 and an explanation. Fulfilled redemptions cannot be refunded; cancelled redemptions cannot be fulfilled. Reward reservation is one unit per request; there are no transfers, cash conversion, automatic expiry, arbitrary bonuses or client-issued awards in this implementation.

Claim and redemption commands persist an exact owner-scoped snapshot before any network mutation. Ambiguous failures preserve that snapshot across restarts. Retry sends the same key and fields. Known 22023 validation rejections clear the pending copy; access failures and conflicting keys remain explicit unresolved requests. Original-account tokens are pinned on every operation, and responses are checked against the current session before being accepted. UI disposal clears private state on unmount; no signed links are stored with commands.

## Permissions and migration ownership

Seven new tables use RLS. Catalog/rules are eligible-user readable; personal financial history is owner readable. Claim review reads are scoped by current staff assignment and aal2. Staff may read only submitted claim evidence through the extended private Storage helper; unused evidence and scans remain outside that reviewer access. Direct table mutations and anonymous command execution are revoked.

Drizzle generates 0008_rewards_tables; 0009_rewards_security owns functions, grants, views, trigger and policies. Supabase CLI remains the only deployment ledger. All eight historical source and deployment migrations remain unchanged. No provider Storage metadata or Auth table is created by application migrations. Tests that simulate Storage metadata are local-only.

## Boundaries and risks

Photos support review; they do not mathematically prove physical disposal. Re-uploading the same bytes under new IDs, staged photos, officer collusion and cross-account abuse are not solved by ID uniqueness. Human review, daily limits and attributed decisions reduce risk but do not replace an abuse policy. Image hashing, moderation tooling, appeals, reversals with compensating ledger entries, account deletion and operational retention require additional design.

No funded catalog, officer identities or completed attendance is fabricated. Existing staff provisioning is not bypassed. An empty catalog/events list and pending claims are correct until operators configure real rewards and staff workflows are integrated. Local Auth/Storage shims do not prove hosted JWT handling, actual uploads, MFA device behavior or multi-connection races. Those require hosted acceptance.
