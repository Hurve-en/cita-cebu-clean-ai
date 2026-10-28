# ADR-017: History Reports and automatic independent rewards

Status: implemented locally; hosted migrations, live AI validation and device acceptance remain required.

## Source and scope

This change overlays the previously supplied Scanner Restored / Photo Submission Fix source. That source contains sixteen migrations through `20261028035602_manual_photo_submission.sql`. Any later edits on the owner's Mac are **UNVERIFIED**; review the changed-file manifest before extraction if there are unshared edits.

The scanner layout, camera, gallery classification, image normalization and saved-photo pipeline remain unchanged. Its history link is relabeled. Authentication, collection schedules, report text submission, report attachments and the event participation reward process retain their existing behavior.

## Different records, one screen

Saved material classifications use `resident_media`. Waste concerns use `reports` and `report_events`. Reward evidence uses `disposal_claims` linked to `scan_reward_sessions`. Participation uses `cleanup_participants`. These are different domain records. They are presented together; their tables are not merged.

A scan and its linked claim/session become one History Reports card. Waste concerns retain `pending_review`, `in_progress` and `resolved`; resolved does not mean an AI reward was verified. Confirmed rewards display the sum of matching `reward_ledger` credits, never the potential `points` value on a pending/rejected claim. Event participation carries its cleanup credit once; supporting event-photo cards show zero additional event points.

The old `view=reports` and `view=history` detail links resolve to the same screen. `view=report` and `view=scan-record` detail routes remain. The signed-out demo also has one combined local history list; it remains an offline preview, not a reward-verification environment.

## NEW endpoint; no new database fields

**NEW:** `public.get_resident_history(p_cursor_time timestamptz DEFAULT NULL, p_cursor_key text DEFAULT NULL, p_filter text DEFAULT 'all', p_item_key text DEFAULT NULL) RETURNS jsonb`.

Only authenticated, eligible residents can call it. The owner is derived from verified database Auth context, never a client argument. Rows are explicitly owner scoped even though the function is a security definer. It returns at most twenty globally ordered items, a twenty-first-row sentinel, and an opaque timestamp/key cursor. `p_filter` is `all`, `saved` or `submitted`. An optional typed item key loads one owned detail; a foreign key returns no items. No dynamic SQL or client role/points/status inputs exist.

**NEW response properties, not database columns:** `items`, `more`, `next_cursor`; each item projects `key`, `owner_id`, `kind`, `id`, `occurred_at`, `title`, `status`, `note`, `description`, `location`, `points`, `submitted`, `photo`, `event_id`. A cursor contains `time` and `key`.

**No new table or column is added.** The existing `claim_valid` constraint now permits an automated final decision with `reviewed_by = NULL`; `reviewed_at` and an explanatory note are still required. `scan_reward_sessions.verifier` records the configured machine verifier. The app never invents a human reviewer.

## Independent evidence

Current single-photo independent submissions enter the private worker queue. The app does not approve evidence or credit points. The private worker downloads the normalized photo, computes SHA-256 and perceptual dHash, and requests a structured visual screening result. Eligible evidence must clearly show waste appropriately placed in a bin or designated sorted collection point. Merely identifying loose trash is insufficient. Ambiguous, unsafe, obviously reproduced or duplicate evidence receives no automatic points and no officer fallback.

The database validates the active worker lease, recipient eligibility, duplicate fingerprints and current daily earning caps in one transaction. It awards **exactly 10 points** as one `disposal` ledger credit keyed to the claim. A repeated/stale verdict cannot credit again. Client roles cannot execute the verdict endpoint or write the ledger. Both existing staff review endpoints reject independent submissions, including older independent review entry points. Previously decided historical records and credits are preserved. Legacy undecided two-photo/manual-only records are preserved; there is no invented single-photo conversion for them.

Existing pending, manual-only single-photo independent sessions are queued by the migration without issuing points. The automation flag is **not enabled by the migration**. The app explicitly displays paused verification when the existing flag is off. An unavailable/misconfigured worker leaves evidence pending; repeated operational failures eventually reject it rather than invent approval.

### What visual AI cannot verify

A still image cannot reliably establish internet originality, capture time, ownership, or a physical disposal action. Gallery images can be downloaded. EXIF/GPS can be forged and normalized images do not preserve a trusted capture attestation. SHA checks catch exact reuse in this system; dHash catches some visual reuse and can also have false matches. Neither searches the entire internet or guarantees authenticity. These limits are stated in the UI. No anti-fraud accuracy claim is made. Live model performance is **UNVERIFIED** until evaluated on representative genuine, ambiguous, reused, edited and downloaded evidence.

Automatic rewards should be activated only after the owner accepts this evidence-screening policy and validates the configured model. Do not describe this implementation as proof that a photo is original or real-world disposal occurred.

## Events

The existing event submission path still enters officer review. Existing registration, timing, assignment and MFA checks remain. Cleanup points come from officer-confirmed participation once per event, not once per photo. The new worker branch only handles a single-photo session with no cleanup event. Existing two-photo/event worker behavior is retained for compatibility.

## Limits and performance

- Ten new media reservations per eligible resident per Philippine calendar day, based on the database clock and existing owner-account lock. All media kinds share the allowance. Cancelled/deleted reservations count that day; replay of the original request returns before quota checks.
- Existing five unfinished-upload cap, hourly capture starts, daily starts, daily independent submission and award/points caps remain.
- Existing two-hundred-scan limit now applies to unused saved drafts, not submitted evidence. Users need not delete retained evidence to make future drafts. No automatic evidence deletion or new retention schedule is introduced.
- History browsing is not upload-rate limited. Each page contains at most twenty records; the client replaces pages rather than accumulating every prior result. Only cursor breadcrumbs are retained for backward navigation.
- The live history screen uses `FlatList`, has no enclosing vertical `ScrollView`, and opens photos on detail/expansion instead of eagerly downloading every image. It does not claim to generate smaller thumbnail files. Page failures retain the visible page and are retryable; stale responses and disposed stores cannot overwrite a later filter/account's screen.
- Rewards has no photo-submission button. It shows the balance, two earning paths, short steps and current rules. While focused and authorized, it refreshes every thirty seconds; it also refreshes on focus and manually. It is not an instant push notification system.

Device memory, frame rate, hosted query latency and multi-connection lock contention are **UNVERIFIED**. Pagination bounds client work; it is not a blanket guarantee against lag at arbitrary production scale.
