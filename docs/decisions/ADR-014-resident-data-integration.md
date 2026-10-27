# ADR-014: Connect resident navigation to authorized server reads

Status: Implemented and locally validated; hosted/device acceptance pending.
Date: 2026-10-27
Baseline: main at `a33da347a8d79c4dabd5ad1247b8485d5d9f3cce` (auth PR #13).
Branch: `feat/resident-data-integration`.

## Problem and outcome

Real authenticated residents previously landed on a separate account workspace while
five-tab resident screens still used demo state. This patch routes eligible residents
into the existing Home, Schedules, Scan, Rewards and Profile navigation. Real account
screens read profiles, published community schedules, owned reports and resident-visible
report activity from Supabase. Demo previews retain their isolated existing behavior.

No migrations, schema changes, new grants, environment variables or dependencies are
introduced. Auth/storage modules and package manifests are not overwritten by this patch.
The existing Drizzle/Supabase migration ownership remains unchanged. Mobile Auth and
PostgREST requests use the existing public client and authenticated session; server-only
Drizzle/PostgreSQL credentials are never imported into the mobile app.

## Data and authorization contract

| Surface | Source and restriction |
| --- | --- |
| Name and selected community | Own profile; barangay name is embedded through its foreign key |
| Community choices | Enabled barangays in bounded pages |
| Collection schedules | Published rows filtered to the selected resident barangay |
| Schedule detail | Published schedule ID within the selected community |
| Reports | Rows explicitly filtered by the authenticated owner's UUID |
| Report detail | Report ID plus owner UUID; inaccessible/missing records show the same unavailable state |
| Report activity | Report ID plus resident visibility; actor IDs are not selected |
| Profile updates | Existing update_own_profile RPC with expected version and authenticated identity |

All reads retain the existing database RLS boundary. Explicit filters are additional
query constraints, not a replacement for RLS. Client decoders reject unexpected owners,
communities, visibility, statuses or malformed rows rather than displaying them as valid
account data. No product role, activation, owner UUID or staff assignment is supplied as
an editable profile mutation argument.

The profile update request pins its Authorization header to the session whose user ID
matches the form owner. A later shared-client identity change cannot redirect that write
to a different user's profile. The server still verifies the JWT and enforces current
eligibility/version rules through its existing RPC. An already sent request can finish
for its original user; it is never reported in a later user's UI.

## State and pagination

The live store is independent from the resident demo store and has no disk persistence.
It is activated only for ready, eligible resident access. Its hook synchronously hides
snapshots whose owner does not match the current eligible user, before effects run.
Logout/access loss clears all live resources and increments request generations. Old
responses cannot populate the next account's state. A community change invalidates old
schedule requests and results while preserving the resident's owned historical reports.
Separate generations prevent profile reloads from undoing newer saves and prevent one
report's delayed activity from populating another detail screen.

Requests project explicit fields and fetch at most 21 rows: 20 displayed plus a next-page
sentinel. Report/schedule cursors use created_at plus UUID, descending; event cursors use
the same pair ascending. Community choices use ascending UUID. Cursor inputs are validated
and timestamps canonicalized before constructing PostgREST expressions. Boundary duplicates
are removed, and failed pagination retains existing rows and a retryable cursor. No total
report count or precise next collection arrival is inferred from a partial page.

This is ordinary cursor pagination, not a cross-request database snapshot. Updates between
pages can change what is visible; refresh starts again. Event timestamp/UUID order is
stable for paging but is not a guarantee of causal ordering for equal timestamps. The
UI does not provide Realtime updates, offline account caches or unbounded background sync.

## Routing and foreground checks

`/workspace/resident` redirects ready residents to `/(tabs)/home`. Resident tab layouts
block nonresident or ineligible accounts. The real detail dispatcher never enters demo
profile/history/report mutation handlers. Development preview access remains signed-out,
explicitly selected and development-only. Staff account workspaces remain unchanged.

The root keeps signed-in navigation mounted while Auth revalidates on foreground/token
refresh. An opaque loading modal covers the navigator during ordinary checking; the live
hook simultaneously hides unavailable resources. This avoids discarding the scanner/photo
picker merely because iOS returns from another app. Existing MFA continuity screens are
not duplicated in that modal. Failed checks or role changes block/redirect the tab layout.
Scanner state is keyed by real user UUID so an identity change discards its photo/result.

No client navigation guard grants database privileges. The existing Auth limitations,
MFA server-enforcement gap and session storage decisions documented in ADR-013 remain.

## UI behavior and deliberate boundaries

- Connected pages identify themselves as Resident account; sample content is not
  substituted for failed or empty server requests.
- Loading, empty, error, refresh and load-more states are distinct. Unknown report/schedule
  IDs have an unavailable state rather than displaying an unrelated sample record.
- Published schedules are weekly recurrence in Asia/Manila. They are not vehicle tracking,
  confirmed pickup promises or exception/cancellation handling.
- Existing profile editing uses real versioned RPC writes, with conflict errors and reload.
- Classification remains on-device. Live scans do not call the demo save/history service,
  upload photos, award points or claim a successful history save. The result is transient.
- Rewards show unavailable state with no fabricated balance/catalog/redemption action.
- Report submission, attachments, account scan history, reminders and notifications remain
  unavailable until their trusted services exist. Unsupported detail views cannot reach
  demo mutations. Offline or backend errors never become a fake successful save.
- Sorting guidance remains static general guidance, separate from server report categories.

## Validation and remaining evidence

Local checks: root Expo lint, strict TypeScript (including generated route declarations),
14 new client read/store tests plus 40 existing auth/resident/officer tests. New tests cover
scope/visibility response rejection, query predicates/projections/limits, null detail rows,
pagination, identity changes, stale requests, community changes and pinned profile writes.
Web/iOS/Android exports validate compilation and module resolution only.

Mocks do not verify actual PostgREST joins, JWT/RLS enforcement, network requests, device
navigation timing, storage behavior or visual/accessibility quality. The prior hosted SQL
foundation checks are background evidence; this branch does not claim they were rerun or
that its HTTP integration has passed hosted tests. Follow docs/resident/ACCEPTANCE.md.
An existing missing app-icon.png favicon warning may appear during export; branding config
is outside this patch. No hosted data, categories, schedules, reports or Auth users are
seeded automatically. A configured project may correctly return empty collections.

Future slices must implement report/media submission, schedule commands, scan persistence,
rewards, staff provisioning and audited administrative operations. Privileged commands need
server-side MFA enforcement and current-role/assignment checks; live staff UI is not covered
by this resident read integration.
