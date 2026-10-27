# ADR-012: Community data and read authorization

Status: Implemented in the Part 2 patch; hosted deployment and verification pending.
Date: 2026-10-27
Baseline: main at 07a9c32f71c011ae256473d48355bc49705bd814.

## Scope

Add shared collection schedules, report categories, private reports and report activity.
This is a database schema and read-authorization slice. The Expo previews keep their
existing demo services. There are no new mobile dependencies or environment variables.
It does not connect the app to Supabase Auth, persist scans, submit reports, upload photos,
or implement officer/admin mutation endpoints.

## Migration ownership

Drizzle owns table definitions and generated SQL. Reviewed custom migrations own
policies, privileges, helpers and triggers. The Supabase CLI remains the only deployment
ledger. Do not run `drizzle-kit push`, Drizzle migrate, or paste generated migrations into
the SQL editor. Preserve the two deployed identity migrations byte-for-byte.

New migrations append in this order:

1. `20261027065955_community_tables.sql`
2. `20261027070020_community_access.sql`

The staging script continues to reject historical edits and competing deployment SQL.
There is no automatic down migration. If deployed code requires correction, add a new
forward migration and review compatibility with existing data.

## Authorization contract

All four new tables enable RLS. Anonymous access and direct client insert, update and
delete privileges are denied. Eligibility is resolved from current database state using
the existing identity rules. A browser or mobile role selector cannot establish access.

| Data | Eligible resident | Eligible assigned officer | Eligible admin |
| --- | --- | --- | --- |
| Enabled report categories | Read | Read | Read |
| Published schedules | Selected barangay | Assigned barangay | All barangays |
| Draft/archived schedules | None | Assigned barangay | None |
| Reports | Own reports | Reports in current assignment | None |
| Resident-visible report events | Own reports | Current assignment | None |
| Internal report notes | None | Current assignment | None |

Changing a resident's selected barangay changes schedule visibility while preserving
ownership of historical reports. Reassigning an officer changes access to existing
community reports and schedules without moving those records. Deactivation removes
access on subsequent statements even with unchanged identity claims. Admin aggregate
reporting or exceptional support access requires a separately designed, audited service.

## Data rules

- Schedule recurrence uses sorted, unique ISO weekdays 1 (Monday) to 7 (Sunday).
  Windows have minute precision, start before end on the same day, and use Asia/Manila.
  Overnight windows and 24:00 are rejected. States are draft, published and archived.
- Schedule barangay, report owner and original report barangay cannot be reassigned.
- Reports use configured category codes, bounded title/location/description, a positive
  version and states pending_review, in_progress and resolved. No real categories or
  barangays are seeded by these migrations.
- Activity distinguishes created, status_changed and internal_note. Internal notes are
  filtered in SQL before data reaches the client. Event constraints require valid status
  edges, initial status on creation, and an explanation for resolution or reopening.
- Events reference both the report and actor. Foreign keys use restrict deletion; retention
  and account-deletion workflows remain a later decision and implementation task.
- Indexes support report owner/community/status, schedule community/status and report
  event queries with timestamp and ID ordering. Clients must still paginate and project
  only necessary columns. These indexes are not a measured performance guarantee.

## Write workflow boundary

No report or schedule write RPC is exposed. Database operators can create fixtures for
tests; privileged SQL is not a supported application workflow. Future trusted commands
must enforce caller eligibility and assignment, configured/enabled categories, actor and
community derivation, valid state transitions, expected version, atomic status plus event
writes, timestamp/version updates, idempotency and retries. Event shape constraints do
not guarantee that a report's current status matches its event stream. Version columns
alone do not implement optimistic concurrency. Operator writes can also bypass RLS.

Report media requires a later private Storage design, path/ownership validation and
cleanup lifecycle. This slice creates no buckets or media-reference columns. The earlier
resident scan/photo persistence issue is still open.

## Validation and limits

Local tests execute all four exact staged migrations against PGlite PostgreSQL with a
minimal Auth/JWT fixture. The existing 40 identity SQL assertions remain passing, and
74 new assertions exercise community isolation, internal-note filtering, assignment
changes, closed writes and constraint failures. Typed Drizzle queries also verify report
ownership and internal-note filtering; attempted ORM report updates are rejected.
Test fixtures are transactional and rolled back. Migration staging/history protection
tests remain in place. Backend TypeScript passes and regenerating schema SQL produces
no additional migration.

Hosted Auth, signed JWT validation, PostgREST joins/projections, MFA, connection pooling,
concurrent command execution, performance/load, mobile integration and device behavior
are not tested by the local suite. Root Expo lint/typecheck must be run in the actual app.
Passing this slice does not mean the backend or application is production-ready.

## Deployment sequence

1. Merge the patch folders into the repository root on `feat/community-data-foundation`.
   Preserve existing files absent from the patch; do not replace entire folders or put
   backend/supabase/docs under src.
2. Run backend typecheck, tests and staging, then root Expo lint and TypeScript.
3. Run `npx supabase migration list` and `npx supabase db push --dry-run` against the
   already linked development project. Both identity migrations must already be applied;
   exactly the two community migrations above should be pending.
4. Review the dry run before running the actual push. Do not reset the remote database.
5. Run `supabase/verify_community_foundation.sql` in the SQL editor. Expected outputs
   are documented at the top of the file. Run the COMPLETE
   `supabase/tests/community_foundation.sql` as postgres in the development project.
   It creates synthetic fixtures and ends with rollback; never execute selected fragments.
6. Repeat verification and confirm zero remaining test accounts/barangays. These SQL
   checks do not substitute for later signed-in HTTP and device tests.
