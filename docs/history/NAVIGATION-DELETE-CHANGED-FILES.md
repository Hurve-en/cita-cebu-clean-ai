# Navigation and pending-deletion patch files

Apply after the previous History Rewards Completion ZIP. Only the files below are overlaid. No scanner/Rewards changes, dependencies or secrets are included. NEW endpoint: public.withdraw_pending_scan(uuid); NEW private helper: cebu_private.is_withdrawn_scan(uuid). No new database fields or tables.

- **NEW** `backend/drizzle/0018_pending_scan_removal.sql`
- **NEW** `backend/drizzle/meta/0018_snapshot.json`
- **CHANGED** `backend/drizzle/meta/_journal.json`
- **CHANGED** `backend/migration-map.json`
- **CHANGED** `backend/test/foundation.test.mts`
- **CHANGED** `backend/test/history-local.sql`
- **CHANGED** `backend/test/history.test.mts`
- **NEW** `docs/decisions/ADR-018-pending-photo-withdrawal.md`
- **NEW** `docs/history/PENDING-DELETE-UPDATE.md`
- **CHANGED** `src/app/detail.tsx`
- **NEW** `src/features/resident/history-deletion.ts`
- **CHANGED** `src/features/resident/history-model.ts`
- **CHANGED** `src/features/resident/history-service.ts`
- **CHANGED** `src/features/resident/history-ui.tsx`
- **CHANGED** `src/features/resident/media-ui.tsx`
- **NEW** `src/features/resident/pending-scan-delete.tsx`
- **NEW** `supabase/migrations/20261028055350_pending_scan_removal.sql`
- **NEW** `supabase/verify_pending_scan_removal.sql`
- **CHANGED** `test/history.test.cjs`
- **NEW** `docs/history/NAVIGATION-DELETE-CHANGED-FILES.md`
