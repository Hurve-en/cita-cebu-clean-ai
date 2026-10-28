# ADR-018: Guided scan rewards and private verification

Status: implemented locally; hosted deployment and provider evaluation pending.

## Context

Residents need smaller rewards for independent disposal without joining a cleanup. Sorting classification and saving history alone cannot establish disposal. The rewards overview was crowded, and disconnected evidence forms obscured the relationship to scan history.

## Decision

Introduce server-issued, short-lived camera capture sessions. Save the before image through the existing scan-media protocol and retain its ID in history and today's Rewards list. Capture after evidence separately, then submit stable photo IDs. Use owner-scoped recovery keys and pinned auth tokens. Keep ordinary sorting scans available without awarding points.

Display today's progress, a short chronological photo list, and three navigation choices. Move the alternative manual officer-reviewed claim form away from the overview. Use server Philippine-day boundaries and show explicit pending, review, approved and rejected states.

Use a private worker for image decoding, exact/perceptual fingerprints and conservative structured vision decisions. No client-provided verdict or amount is trusted. Automatic awards default OFF until operator evaluation and consent for paid verification. Final points are an atomic server ledger effect. Protect cross-path evidence reuse, shared daily independent earning limits and idempotent finalization.

Keep all ten deployed migrations immutable. Add two Drizzle migrations, stage their Supabase deployment copies through the existing migration map, and keep generated snapshots consistent.

## Consequences

A separate private process and provider configuration are required for automated verification. MFA and assigned-community checks protect manual review; the staff UI is not included. Existing cleanup rewards remain separate. Private before/after images are disclosed as verification evidence and may be sent to the configured provider.

Limits default to 3 independent awards/30 points per Philippine day, one accepted session start per 60 seconds, 5/hour and 10/day. They are per-account controls and cannot stop account farms. The worker caps attempts at 3/session and 100/day globally. Exact hashes detect byte reuse; perceptual hashes flag similarity, with possible false positives. Neither a challenge nor an AI model proves authenticity or real-world conduct.

No live provider call, hosted deployment, model-quality evaluation or multi-connection concurrency test was performed during patch preparation. Public rollout requires those checks, funded redemption inventory, monitoring and support processes.
