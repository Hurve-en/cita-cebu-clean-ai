# Resident Rewards — Part 7

Prerequisite: Part 6 resident media/history is merged and its eight migrations are applied. Use `feat/resident-rewards`. This ZIP updates app/backend source and adds two migrations. It includes no credentials, dependencies or Expo device cache. No dependency install, native module addition or native rebuild is required.

## Apply and check locally

From the CebuCleanAI repository root:

```bash
unzip -o ~/Downloads/CebuCleanAI-Resident-Rewards-Part7.zip -d .
npm run typecheck --prefix backend
npm test --prefix backend
npm run db:stage --prefix backend
npx expo lint
npx tsc --noEmit
node --test test/auth.test.cjs test/resident-store.test.cjs test/officer-service.test.cjs test/resident-read.test.cjs test/report-submission.test.cjs test/resident-media.test.cjs test/rewards.test.cjs
git diff --check
```

`db:stage` is local only. Expected: ten migration handoffs. None of these commands deploys to Supabase. Do not change any already-applied migration to fix a hosted issue; append a new migration.

## Preflight and deploy

Run `supabase/preflight_rewards.sql` in Supabase SQL Editor. Run each statement separately if only the final result is displayed. Expected: zero conflicting relations, commands and evidence; existing bucket private, JPEG-only, 2097152 bytes.

Then run:

```bash
npx supabase migration list
npx supabase db push --dry-run
```

The only pending migrations should be:

```text
20261027225422_rewards_tables.sql
20261027225429_rewards_security.sql
```

After reviewing the intended target and preview:

```bash
npx supabase db push
npx supabase migration list
```

All ten Local and Remote IDs should match. Run `supabase/verify_rewards.sql` statement by statement. Expect seven tables with RLS and no anonymous read/direct writes, ten authenticated-only commands, one rule row, the unchanged private bucket, seven Storage policies and a security-invoker unused-evidence view.

Do not create another bucket or add generic Storage policies. Never execute `backend/test/*local.sql` or `backend/test/media-storage-shim.sql` on Supabase. Those files mutate fake local provider metadata; they do not upload real bytes.

## Start the existing iOS development build

```bash
npx expo start --clear
```

Use a real resident account, not the demo. Open Rewards. Its overview shows a server-verified balance, the two earning paths, catalog and activity histories. A blank catalog is intentional until funded inventory is configured. There is no fake opening balance.

Run the resident checks in ACCEPTANCE.md. Send any failed step and the exact error. Hosted staff approval/fulfillment needs eligible staff accounts with MFA and the later officer/admin integration. SQL Editor runs as an operator and is not proof that a resident or officer device is correctly authorized.
