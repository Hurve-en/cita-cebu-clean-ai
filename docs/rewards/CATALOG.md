# Catalog and earning rule configuration

The migration creates a rule row with 10 independent-disposal points, 50 cleanup points and a limit of 3 independent submissions per Philippine day. It creates no catalog items, staff accounts, events or free points.

Only a trusted operator may configure the catalog until the administrator workflow is integrated. Confirm funding, quantities and pickup arrangements first. Never grant clients direct INSERT/UPDATE on the catalog, ledger or rules.

Example of a disabled draft item, for an operator to edit deliberately:

```sql
insert into public.reward_catalog(name,description,cost,stock,enabled)
values (
  'Reusable cleaning gloves',
  'Collect one pair of reusable cleaning gloves from the barangay office.',
  100,
  0,
  false
);
```

This draft is invisible to residents and cannot be redeemed. Replace the example with actual program inventory. Record the item's returned ID, update only that intended item with confirmed stock, and enable it only when fulfillment is available. Do not repeatedly run INSERT when trying to edit an existing item.

Rules can be changed by the trusted operator in `public.reward_rules` where id=1. The constraint requires positive values and a larger cleanup award. Existing claims/events keep their snapshotted awards; existing reservations keep their snapshotted cost. Price edits never change past redemptions.

Staff RPC contract (all require actual authenticated JWTs; review/creation/fulfillment also require aal2 and appropriate current assignment):

| Command | Purpose |
| --- | --- |
| `create_cleanup_event` | Publish a future event with rule-derived award and capacity |
| `review_disposal_claim` | Approve/reject a pending claim with a review explanation |
| `verify_cleanup_participation` | Verify completed participation after the event ends |
| `fulfill_reward_redemption` | Record actual pickup for a pending reservation |

Staff must use their own accounts; identity is always derived from the verified JWT. Never paste access tokens, database credentials or service-role keys into source files or PRs. The app uses the existing public URL and publishable key; no environment variable changes are needed.
