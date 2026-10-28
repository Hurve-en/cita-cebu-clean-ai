# Changed-file overlay

Based on the previously supplied Scanner Restored / Photo Submission Fix project. Only the files below are overlaid; unchanged project files are omitted. No secrets, dependencies or native build folders are included.

NEW endpoint: `public.get_resident_history(timestamptz,text,text,text)`. No new database field/table. Existing functions are replaced only by the new append-only migrations.

- **CHANGED** `backend/db/schema.mts`
- **NEW** `backend/drizzle/0016_automated_claim_review.sql`
- **NEW** `backend/drizzle/0017_resident_history_completion.sql`
- **NEW** `backend/drizzle/meta/0016_snapshot.json`
- **NEW** `backend/drizzle/meta/0017_snapshot.json`
- **CHANGED** `backend/drizzle/meta/_journal.json`
- **CHANGED** `backend/migration-map.json`
- **CHANGED** `backend/package.json`
- **CHANGED** `backend/test/foundation.test.mts`
- **NEW** `backend/test/history-local.sql`
- **NEW** `backend/test/history.test.mts`
- **CHANGED** `backend/test/rewards.test.mts`
- **CHANGED** `backend/test/scan-rewards.test.mts`
- **CHANGED** `backend/test/scan-verifier.test.mts`
- **CHANGED** `backend/workers/scan-verifier-core.mts`
- **CHANGED** `backend/workers/scan-verifier.mts`
- **NEW** `docs/decisions/ADR-017-history-and-automatic-independent-rewards.md`
- **NEW** `docs/history/ACCEPTANCE.md`
- **NEW** `docs/history/AI-WORKER.md`
- **NEW** `docs/history/INSTALL.md`
- **NEW** `docs/history/VALIDATION.md`
- **CHANGED** `src/app/(tabs)/home.tsx`
- **CHANGED** `src/app/(tabs)/profile.tsx`
- **CHANGED** `src/app/(tabs)/scan.tsx`
- **CHANGED** `src/app/detail.tsx`
- **NEW** `src/features/resident/history-model.ts`
- **NEW** `src/features/resident/history-service.ts`
- **NEW** `src/features/resident/history-store.ts`
- **NEW** `src/features/resident/history-ui.tsx`
- **CHANGED** `src/features/resident/live-ui.tsx`
- **CHANGED** `src/features/resident/media-ui.tsx`
- **CHANGED** `src/features/resident/report-submission-ui.tsx`
- **CHANGED** `src/features/resident/report-submission.ts`
- **CHANGED** `src/features/rewards/reward-capture.tsx`
- **CHANGED** `src/features/rewards/rewards-model.ts`
- **CHANGED** `src/features/rewards/rewards-service.ts`
- **CHANGED** `src/features/rewards/rewards-ui.tsx`
- **NEW** `supabase/migrations/20261028050830_automated_claim_review.sql`
- **NEW** `supabase/migrations/20261028050831_resident_history_completion.sql`
- **NEW** `supabase/verify_history_completion.sql`
- **NEW** `test/history.test.cjs`
- **CHANGED** `test/rewards.test.cjs`
- **NEW** `docs/history/CHANGED-FILES.md`
