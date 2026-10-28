# Local validation

The overlay is tested against the last supplied Scanner Restored project source. No real Supabase project or paid AI provider was contacted.

Required checks:

```bash
npm run typecheck --prefix backend
npm test --prefix backend
npm run db:stage --prefix backend
npx expo lint
npx tsc --noEmit
node --test test/*.test.cjs
```

The backend suite executes all eighteen migrations, checks immutable staging and security foundations, and runs current History/automatic-reward assertions. Historical rewards/scan fixtures deliberately run against the sixteen-migration deployed baseline to retain regression coverage for the old policy; `backend/test/history.test.mts` separately executes all eighteen migrations and tests the new independent policy and unchanged event workflow. The legacy fixture coverage is not presented as testing the current independent review policy.

New checks cover global pagination across record types, shared-timestamp boundaries, foreign direct lookup, status preservation, actual ledger amounts, paused automation, worker-only decisions, stale leases, duplicate rejection, machine attribution, both blocked staff endpoints, event participation credited once, and a shared ten-upload daily cap including deleted reservations and same-request replays. Client checks cover bounded page replacement, filter races, disposed stores, failed pagination retries, ownership/token pinning and machine-reviewed claim decoding. Worker tests validate structured requests and conservative decisions without external calls.

Expo iOS and web export/bundle checks are included. These do not exercise the ONNX camera path, real device safe areas, actual AI accuracy, real Storage transfer or hosted concurrent transactions. Those remain **UNVERIFIED** until acceptance.

The generated Drizzle constraint and snapshot are synchronized with `backend/db/schema.mts`. No new database columns are introduced. The sixteen previously deployed Drizzle sources and Supabase SQL files are byte-for-byte unchanged.

Recorded local results: Expo lint passed with zero errors/warnings; frontend and backend TypeScript checks passed; all 133 client tests passed; the complete backend suite passed; 18 migration handoffs validated; Drizzle reported no schema drift; iOS and web exports succeeded. Original scanner diff: one history-button label only. No remote database mutation or provider charge was performed.
