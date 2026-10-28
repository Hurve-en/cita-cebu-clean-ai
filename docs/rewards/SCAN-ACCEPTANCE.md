# Scan rewards acceptance

## Local validation

The patch is covered by the existing identity, community, reports, media and rewards suites, plus scan-session/worker permission, duplicate, recovery and daily-limit checks. Local PostgreSQL runs through PGlite with Auth and Storage shims. No live AI API was called. iOS and web exports verify bundling, not device behavior or model quality.

## Hosted/device checklist — still required

- Confirm original ten migrations remain matched; deploy only the two new migrations after preflight.
- Run verify_scan_rewards.sql and inspect all grant/RLS rows, worker restrictions and automatic flag OFF.
- Sign in on iOS; ordinary scans save history without awarding points.
- Open Rewards; check today summary, photo timestamps, short list and clear navigation at small screen sizes and large text.
- Start reward capture; deny/grant camera permission and cancel both capture steps. Confirm saved preview and save button stay in the same card and respect safe areas.
- Save before photo; confirm the identical scan appears in history and today Rewards. Capture after evidence and submit; pending must show zero awarded points.
- Restart during upload, after upload acknowledgement loss, and after submit acknowledgement loss. Recover without duplicate photos, sessions or credits.
- Switch/logout accounts during requests. No old identity data should appear in the next session.
- Test expired captures, rejected evidence, offline retries, server limits and Philippine midnight boundaries.
- Configure a private review-only worker only after approving provider spending. Test actual signed JWTs, private downloads, model support and verdict quality.
- Evaluate screenshots/internet photos, similar scenes, legitimate repeated bins and unsafe examples. Human review must handle uncertainty; no authenticity guarantee is implied.
- Test simultaneous independent-award requests over multiple real database connections: at most three awards/30 points per day, without affecting cleanup awards.
- Test assigned staff MFA review using constrained RPCs; officer/admin UI integration is still future work.
- Enable auto awards only after review. Confirm a new approved session credits once and balance refreshes; rejection/review never credits automatically.
- Verify catalog stock and real fulfillment before offering redeemable rewards publicly.

Do not mark this feature production-ready based only on local tests.
