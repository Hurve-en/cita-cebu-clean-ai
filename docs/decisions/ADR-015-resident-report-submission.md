# ADR-015: Atomic resident text report submission

Date: 2026-10-27
Status: Implemented locally; hosted deployment and device acceptance pending
Branch: feat/resident-report-submission
Depends on: ADR-011 through ADR-014

## Problem

Residents can read their reports, but real report creation is unavailable. Opening
client table writes would let untrusted requests provide ownership, workflow state
or activity attribution. A lost network response can also cause duplicate reports
if a client blindly retries with a fresh identifier.

## Decision

Use one Supabase PostgreSQL command, `submit_resident_report`, with six inputs:
request UUID, expected selected barangay UUID, title, category code, location text
and description. The expected community is an assertion against the profile;
it never authorizes routing to an arbitrary community. There is no owner, actor,
role, status, event visibility or attachment input.

The SECURITY DEFINER function has an empty search path and qualified relations.
It derives identity from auth.uid(), locks that account_access row FOR UPDATE and
requires the existing enabled, verified, ready resident eligibility checks. Staff
and unauthenticated callers cannot create resident reports through this command.
EXECUTE is granted to authenticated only. Existing direct report/event DML grants
remain closed. The server remains authoritative regardless of UI routing.

For new submissions it locks the resident profile, enabled selected barangay and
enabled category rows FOR SHARE, validates text, then inserts all three records:

1. Report owned by the actor, routed to the selected barangay, pending_review.
2. Resident-visible created activity attributed to the same actor.
3. An internal retry receipt keyed by (owner_id, request_id), linked uniquely to
   that report and containing the canonical request payload.

Any error rolls back all three inserts. The row lock serializes submissions by the
same owner and coordinates with the existing profile command, which locks the
account row before profile changes. Locks end with the request transaction. Future
access/configuration writers must preserve compatible lock order; cross-owner
submissions are independent. Multi-connection contention has not been tested here.

## Retry contract

A repeated eligible resident request with the same key and canonical payload
returns the original report and replayed=true, without another activity or receipt.
A different payload with that key raises 23505. The key is owner scoped: two
residents may independently use the same UUID. Basic validation and current
account eligibility precede receipt lookup; a disabled account cannot replay.

A committed receipt may be confirmed after the resident changes barangay or the
original category/community is disabled. New writes still require the current
enabled configuration. Report ownership/community are immutable in this workflow.

The app creates a UUID using the existing Expo uuid export and persists the retry
snapshot before issuing the request. The RPC is pinned to the captured owner's
access token, so a shared client switching sessions cannot redirect a mutation to
a later account. Responses are decoded for request key, owner, community and text.

Timeouts, transport failures, malformed confirmations and unknown server errors
retain the same immutable snapshot and key. A definitive SQL 22023 validation
rejection clears that copy and allows corrections. A 23505 conflict never creates
a replacement key automatically. A 42501 rejection keeps the pending copy for
access review. Double taps are single flight within a form.

The snapshot survives navigation and app restart. Reopening does not automatically
send a command: the resident explicitly retries/confirms. A confirmed response
refreshes My Reports. The retry copy remains until the resident acknowledges
success with View submitted report. If a component unmounts while a write is in
flight, its response cannot publish into the next form/account; the original
owner can later confirm with the retained key. A list refresh failure does not
invalidate a confirmed write.

## Privacy and retention

Pending snapshots use a separate owner-scoped key in the existing auth storage
adapter: `cebuclean:report-submission:v1:<owner UUID>`. They contain report text and
request identifiers, never passwords or tokens. This is a deliberate exception to
the prior read-only store's no-disk-cache decision. Native storage is SQLite-backed;
web uses localStorage. These snapshots are not additionally encrypted by this
feature and are not erased on logout, so the same resident can confirm a delayed
write after signing back in. Another account's form does not load them. Device
backup/compromise and web script access remain relevant to this storage choice.

Corrupt data is preserved and blocks overwrites. No automated repair, abandoned
snapshot expiry, shared-browser cross-tab coordination or account-deletion cleanup
is implemented here. Two tabs concurrently initiating different keys can produce
two distinct reports; only reuse of the same key is deduplicated. Avoid concurrent
submissions from multiple tabs while device-level coordination remains future work.

Server receipts duplicate normalized report text and have no client table grants
or policies. Report/owner foreign keys restrict deletion, preventing accidental
loss of retry evidence. No automatic receipt expiry is introduced: future deletion,
retention and erasure workflows must explicitly handle receipts and activity.
Database operators can access this data and remain part of the trust boundary.

## Configuration and UI

No category or community is seeded by a migration. An optional reviewed operator
SQL example supplies four suggested category labels; it preserves existing rows.
The taxonomy is a product proposal, not an official local-government classification.
Actual enabled barangays must already be configured by an authorized operator.
The form reads enabled categories in bounded cursor pages and shows loading,
empty and error states. A selected community is required for a new report.

The form includes title, category, location/landmark and multiline description,
validation hints, character limits, retry state and confirmed submission state.
Reports remain pending review; submission does not promise a response time or a
collection visit. Photos, coordinates, notifications, reward points, scan history,
report editing and officer/admin mutation APIs are outside this change.

## Migration ownership

Drizzle owns the table schema and snapshots. Its reviewed custom security migration
owns privileges and the command. The existing staging script maps the two additions
to Supabase deployment SQL. Only Supabase CLI applies migrations. The original four
migration files and their historical mappings are preserved. Never use drizzle-kit
push or edit an applied migration to deploy this feature.

## Validation and limits

Local PostgreSQL/Auth-shim suites cover identity/community permissions plus 52
submission assertions: actor restrictions, owner/community derivation, validation,
receipt replay/conflict, direct DML denial, event attribution and injected failure
rollback. Frontend tests cover validation, owner-token pinning, response decoding,
single-flight submission, persisted retry, storage failures and stale responses.
Existing frontend regression suites remain part of acceptance.

Hosted JWT/PostgREST RPC exposure, real concurrent transactions, iOS storage/network
behavior, Android/web acceptance, rate limits, abuse detection and operational
monitoring are not proven by local tests. The feature is not a blanket production
readiness claim. Complete the acceptance checklist before merging/deployment signoff.

## References

- https://supabase.com/docs/guides/database/functions
- https://www.postgresql.org/docs/17/explicit-locking.html
- https://orm.drizzle.team/docs/indexes-constraints
- https://docs.expo.dev/versions/v58.0.0/sdk/expo/
