# ADR-018: Delete pending independent photos without quota or reward bypass

Status: implemented and tested locally; hosted/device acceptance required.

The resident can withdraw a pending independent single-photo claim and delete its image, including when a verifier already holds a lease. No new domain field or status is introduced. A private endpoint records rejected/withdrawn in the existing claim/session records, sets the existing verifier field to an explicit resident-withdrawal marker, clears the lease and begins the existing media deletion protocol.

The transaction uses the worker's config/account/session/claim lock order. A settled award cannot be withdrawn; a withdrawn item cannot receive a stale award. Row tombstones and original request keys remain, preventing daily-cap resets and upload/submission resurrection. Physical Storage removal must succeed before metadata finalization and UI success. A failed byte removal remains retryable.

The evidence-retention trigger permits state transitions only to delete_pending/deleted for a matching server-authored withdrawal with no credit and no conflicting references. Normal awarded/rejected evidence and event submissions remain protected. No client can author the withdrawal marker or ledger entries directly.

**NEW endpoint:** public.withdraw_pending_scan(uuid). **NEW private helper:** cebu_private.is_withdrawn_scan(uuid). **No new database fields or tables.** Append-only custom migration 0018 follows all eighteen deployed migrations.

History pagination remains twenty records per page. User-facing page controls are explicit and only displayed when available. Back is moved to a fixed bottom area on live History Reports. No scanner/Rewards redesign is included.

See docs/history/PENDING-DELETE-UPDATE.md for installation, operational semantics and device acceptance. Local stale-lease tests are not proof of hosted multi-connection contention behavior.
