# Apply this changed-files overlay

Use this on the branch containing the sixteen deployed migrations through `20261028035602_manual_photo_submission.sql`. The ZIP contains only changed/new files, not dependencies, secrets or the whole app. It is based on the last Scanner Restored ZIP; unshared local changes are UNVERIFIED.

From the CebuCleanAI project directory:

```bash
git status --short
unzip -o ~/Downloads/CebuCleanAI-History-Rewards-Completion.zip -d .
npm run typecheck --prefix backend
npm test --prefix backend
npm run db:stage --prefix backend
npx expo lint
npx tsc --noEmit
node --test test/*.test.cjs
git diff --check
```

No additional package is required. If dependencies are not installed, use the existing project lockfiles (`npm ci` and `npm ci --prefix backend`). Never run a force audit fix as part of this overlay.

Then inspect:

```bash
npx supabase migration list
npx supabase db push --dry-run
```

Only these two new migrations should be pending:

- `20261028050830_automated_claim_review.sql`
- `20261028050831_resident_history_completion.sql`

If a private worker is already running, deploy the updated worker code before this migration queues existing single-photo submissions. An old two-photo-only worker cannot process them correctly. Current private-host deployment is UNVERIFIED.

If the two pending filenames match, apply them using the normal CLI confirmation:

```bash
npx supabase db push
npx supabase migration list
```

Run the read-only `supabase/verify_history_completion.sql` in the SQL Editor. Expected: authenticated history = true; anonymous history = false; client verifier = false; private worker verifier = true. Automation remains at its existing value. It is deliberately not enabled by installation.

Do not execute `backend/test/history-local.sql` in hosted Supabase. It uses synthetic Auth/Storage fixtures and is only for the local test runner.

Start your existing development build with Metro as usual. No new native dependency was added:

```bash
npx expo start --clear
```

The private AI worker is separate from the Expo app. Follow `docs/history/AI-WORKER.md`. Without a configured worker and enabled automation, independent evidence remains pending and no automatic points are issued. Installation alone is not proof of live AI verification.

The branch is ready to commit after the hosted/device checklist in `docs/history/ACCEPTANCE.md` passes. Do not include `.env`, server credentials, `.expo`, node_modules or Supabase temporary files in the commit.
