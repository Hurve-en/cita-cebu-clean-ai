# Scan rewards update — apply after Part 7

> Historical rollout guide. After the Unified Scan update, use UNIFIED-SCAN.md for current navigation and event attribution.

This patch requires the Resident Rewards Part 7 code and all ten existing migrations. It does not replace or edit deployed migrations. Apply on the existing rewards branch, with unrelated work committed or backed up.

## Behavior

- Ordinary scans remain sorting guidance and saved history. They do not automatically earn points.
- Rewards → Scan for rewards opens a camera-only before/after capture. A server-issued finger challenge and five-minute deadline precede capture. The before photo is also a normal saved scan, so the same scan appears in history and today's Rewards list.
- Before evidence shows the item. After evidence should clearly show that item in an appropriate bin and the requested number of fingers beside it. Avoid people and private information.
- Saving evidence does not award points. A private verifier processes submitted evidence; uncertainty goes to review, rejection earns nothing, and only a confirmed server ledger credit updates the balance.
- Today uses Asia/Manila midnight and server time. Every listed photo shows its time and verification status. Past scans remain in history.
- Independent awards default to 10 points, at most three awards and 30 points per day across this flow and older disposal claims. Barangay cleanup rewards remain separate and larger (existing default 50 points).

## Apply

Download the ZIP to Downloads and unzip from the CebuCleanAI project root. No npm dependency installation or native rebuild is introduced by this patch. Existing root and backend dependencies must already be installed.

Run the validation commands supplied with the ZIP, then inspect:

```sh
npx supabase migration list
npx supabase db push --dry-run
```

Only these two migrations should be new:

- `20261027235141_scan_reward_tables.sql`
- `20261027235143_scan_reward_guardrails.sql`

Before deployment, run `supabase/preflight_scan_rewards.sql` in the intended project's SQL editor. Expected conflicts: 0 tables and 0 commands. Confirm the existing resident-media bucket is private and JPEG-only, with the existing 2 MiB limit. Deploy only after confirming the target project and expected dry run. Afterwards run `supabase/verify_scan_rewards.sql`. Do not run local fixture SQL on hosted Supabase.

## Default state after deployment

Automatic awards are OFF. Camera capture and submission are available, but submissions wait until a private worker is configured. See PRIVATE-WORKER.md. Do not promise immediate points before this setup and acceptance testing. Staff review RPCs exist; officer/admin review screens remain a separate integration task.

## Limits and recovery

Accepted capture starts: one per 60 seconds, five per hour and ten per Philippine day per account. A session expires after five minutes or at midnight, whichever comes first. Award limits are enforced in PostgreSQL, including legacy claim approvals. Double taps and retries reuse session keys and photos; a lost acknowledgement can be recovered without awarding twice. Local storage failures block uploads that cannot be recovered safely.

The worker has a global 100-attempt daily budget and three attempts per session. These are account/server limits, not IP throttling or protection against multiple fraudulent accounts. Add gateway throttling and account-abuse monitoring before a public launch.

Exact-byte duplicates are rejected across sessions. Similar-image hashes send evidence to review and can produce false positives. Camera-only UI, timestamps and finger challenges are friction, not cryptographic proof of capture time or liveness. A modified client can submit other images. The bundled MobileNetV2 classifier cannot verify authenticity, internet provenance, or disposal. No system here guarantees that an image is original or that an action happened.
