# Local validation record

Date: 2026-10-27
Baseline: main 924211aa (merged resident report submission PR #15).

- Expo lint and root/backend TypeScript: passed.
- All 94 client tests passed: 71 existing plus 23 media tests.
- Identity, community and report-submission suites remain passing.
- 52 additional local media/Storage-policy assertions passed with the provider metadata shim.
- Media preflight and deployed structural-verification SQL executed locally and matched expected values.
- Fixture rollback and direct metadata DML denial passed.
- Lost upload/finalization responses, cancelled keys, interrupted removal, session switching, durable-before-remote writes, collection pagination and stale responses covered by client tests.
- Drizzle generation reported no remaining schema change.
- Eight migration handoffs validate; original six sources, deployment SQL, snapshots and mappings byte-for-byte unchanged.
- Auth storage, barcode/classifier files, ONNX asset hash, dependencies, app config and barangay picker fixes unchanged.
- iOS Hermes/web bundles exported successfully. The existing baseline favicon warning remains: assets/images/branding/app-icon.png is missing.
- Hosted deployment, bucket configuration, real provider uploads/deletes, signed URL authorization, multi-connection races, iOS camera/gallery/storage and Android/web device acceptance remain pending.

The ZIP contains only changed/new source, migrations, tests and documentation. It excludes environment values, dependencies, generated bundles, caches and local Expo device metadata. No commit, push, PR publication or remote migration was performed.

The local Storage metadata shim is NOT a hosted Storage service. Do not execute backend/test/media-storage-shim.sql in Supabase SQL Editor. Use docs/media/ACCEPTANCE.md for actual hosted checks.
