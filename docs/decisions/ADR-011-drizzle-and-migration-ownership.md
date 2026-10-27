# ADR-011 — Drizzle and migration ownership

Date: 27 October 2026.

## Context and decision

The owner explicitly chose Drizzle and confirmed the prior SQL-only foundation ZIP was untouched. The replacement foundation therefore begins from a new unapplied baseline. This does not approve all other proposed PRD choices or a hosted deployment.

Use Drizzle ORM for typed PostgreSQL schemas/queries in trusted backend code. Use Drizzle Kit to generate structural migration SQL and record local schema snapshots. Keep grants/policies/triggers/functions in reviewed custom SQL migrations. Stage both categories into timestamped Supabase migrations using a stable checksum-validated map.

Supabase CLI is the sole deployment runner and remote migration history. Do not apply the same chain using Drizzle migrate/push as well. No Drizzle database migration ledger is introduced. Snapshots, a local generation journal and a source/target handoff map are engineering artifacts rather than competing database application histories.

## Security boundaries

Drizzle does not provide authentication or automatically scope owner-level PostgreSQL connections to a phone user's identity. Elevated connections remain trusted-server only. Future request handlers require verified identity/current access and constrained user-authorized operations. Supabase Auth, private media Storage and database policies retain their architectural responsibilities.

The Expo client must not import backend connection code or receive database credentials. No extra Next.js server or microservice is introduced by this choice. Actual deployed runtime/driver compatibility is tested with the first server handlers.

## Consequences

- The schema and generated snapshots must stay aligned; a repeat generation should have no unexpected changes.
- Custom security changes require their own reviewed migrations; do not duplicate the same policies in a conflicting schema definition.
- Staged history is immutable; changed applied intent requires a new migration.
- Commit schema, snapshots, custom SQL, handoff map, deployment files and tests together when authorized.
- Existing local/static docs should reference this ADR when describing database implementation. The high-level architecture boundaries are unchanged.
- The previous ZIP is superseded. If a user later reveals it was applied after all, stop the fresh-baseline path and reconcile history without dropping data.

## Validation and remaining gates

The replacement package passed backend typechecking, schema generation/no-change regeneration, 40 database assertions, ORM role-scoping checks and handoff integrity checks locally. Provider identity is shimmed in embedded tests; hosted Auth/API/MFA/pool and device tests remain unverified. This ADR is not a release sign-off.
