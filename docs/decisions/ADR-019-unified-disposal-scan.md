# ADR-019: One Scan entry with independent and cleanup-event attribution

Status: implemented locally; hosted deployment and device acceptance pending.

## Context

A separate Scan for rewards entry confused the resident journey. The product needs a single Scan flow, smaller independent rewards, and larger rewards for participation in officer-created cleanup events. A material classification photo cannot establish proper disposal or prove that an image is original.

## Decision

The signed-in Scan tab opens the existing before/after evidence capture directly, with independent disposal selected by default and an alternative barangay cleanup choice. A secondary identification-only option retains gallery and ordinary material scanning without earning points. Demo scanning is unchanged. Old reward-scan links redirect to Scan; Rewards links open the same tab.

Add nullable cleanup_event_id to scan_reward_sessions. Existing captures are independent. New start_scan_capture binds an optional event to the durable request. Request retries cannot change activity or community. Independent starts retain earning caps; both kinds share capture cooldown and attempt limits. Event starts require a currently published, ongoing event in the resident's active community and joined participation. Submission rechecks that eligibility. Camera evidence retains the same before-scan ID used in history.

The private worker can assess event evidence but cannot issue either an independent or a cleanup credit for it. review_scan_reward refuses event sessions. Existing verify_cleanup_participation remains the single event award path: assigned staff with MFA confirm participation after the event and award once per participation. The larger reward is not repeated for each image. Staff UI integration is separate; no new administrator is provisioned here.

Today activity includes event title, participation state and the actual single event award after participation is completed. Independent progress retains its separate daily cap. Scan ledger rows now decode correctly in point history.

## Migration ownership

Append generated Drizzle migration 0012 and custom access migration 0013, then stage through the existing map. All twelve previously deployed SQL migrations and mapping entries remain unchanged. New generated snapshots match the schema. No dependency or native configuration change is required.

## Tradeoffs and limits

Before/after images, a finger challenge and hashes support fraud screening but do not prove liveness, internet originality or a real-world action. A modified client can bypass camera UI. Private vision verification still needs operator configuration, evaluation and paid-provider consent; automatic awards stay OFF. Rate limits are per account, not protection against account farms. Officer confirmation remains necessary for larger event rewards.

Joining before the event starts remains the existing registration policy. This update does not silently register residents during an event. Events must first be created through the existing staff backend; officer/admin live UI integration remains unfinished. The event option lists at most 21 joined ongoing events, ordered by start and ID.

## Superseding correction: restore scanner and manual single-photo submissions

The resident rejected replacing the original scanner screen. Restore the pre-unified scanner layout/styles and add only a submission action after a confirmed saved result. Rewards now renders the current balance and photo-submission entry, without the overview dashboard. Existing redemption and event data remain intact.

Use the existing reward-scan route for a post-classification form. Gallery photos are classified and saved as scans, then use the same form as existing saved scans. The material classifier does not verify authenticity; all new one-photo submissions go to officer review. No private vision worker or paid API is required for this manual path.

Reuse existing disposal_claims, scan_reward_sessions and their existing columns. Allow the existing after_id column to be null, explicitly validate that a one-photo submission refers to an owned ready scan and an owned activity-bound request, and expand the existing claim points bound to match existing cleanup event bounds. No new application table, column or RPC signature is added. Existing two-photo and historical workflows remain compatible.

New single-photo sessions enter review, not pending worker processing, and are never leased by the AI worker. Both staff review entry points converge on one claim decision. Independent approval creates one disposal ledger credit; event-photo approval requires completed participation and creates no extra credit. Existing eligibility, MFA, daily caps, request-id replay and photo-retention protections still apply. Saved metadata are upload/classification records, not proof of physical capture time.
