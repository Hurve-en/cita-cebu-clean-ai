# Private scan verification worker

This is optional private Node.js infrastructure, not mobile app code. No worker is deployed and no paid verification is enabled by applying the ZIP. OpenAI vision calls incur separate provider charges and transmit the submitted before/after photos to that provider. Obtain the project owner's consent and set appropriate privacy, retention and budget controls before enabling it.

## Requirements

Node.js 20.19 or newer, installed root and backend dependencies, a private server/process supervisor, outbound HTTPS to the Supabase project and OpenAI Responses API. The worker reuses the project's existing jpeg-js dependency. Keep the complete source layout with backend beside the root package.json.

Set these variables ONLY in the private worker environment:

```dotenv
REWARDS_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
REWARDS_SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
OPENAI_API_KEY=YOUR_PRIVATE_OPENAI_KEY
REWARDS_VISION_MODEL=YOUR_EVALUATED_VISION_MODEL
REWARDS_ALLOW_PAID_VERIFICATION=true
```

Never prefix private keys with EXPO_PUBLIC_, put them in the mobile .env, commit them, or bundle them in the app. The service-role key bypasses RLS and must stay private. The mobile app retains its existing publishable key and URL only. Choose a Responses API model supporting image input and strict structured output; test that choice on representative local waste and bin examples before automatic approval.

Run one queued review from the project root:

```sh
npm run rewards:verify --prefix backend
```

For a supervised polling process:

```sh
npm run rewards:verify --prefix backend -- --watch
```

These commands require environment variables already supplied by your private host. They do not load a mobile .env automatically. Deploy the process on infrastructure you control, configure restart/health monitoring, and review cost and error metrics. No hosting configuration is included.

## Rollout

1. Keep `auto_awards_enabled=false`. Configure keys and model privately, with explicit approval for provider spending. The worker's paid flag must be true even in review-only mode because model calls still cost money.
2. Test captures, cancellation, reconnection and pending recovery on iOS. Evaluate clear legitimate disposal, wrong bins, screenshots, printed photos, repeated images, finger mismatches, ambiguous images and unsafe actions. Check false approvals and rejection rates with human reviewers. No confidence calibration is claimed.
3. Review-only processing stores verdicts and hashes without automatic credit. Assigned eligible officers/admins with MFA can use the constrained review RPC; a staff review screen is not supplied in this patch.
4. After evaluation and explicit operational approval, enable automatic credit in the intended project's SQL editor:

```sql
update public.scan_reward_config
set auto_awards_enabled = true
where id = 1;
```

Disable automatic credit with the same statement setting false. This stops new automatic credits; it does not stop queued verification spending. Stop the worker or remove its paid-verification opt-in to stop model calls. Existing ledger credits remain unchanged.

## Boundaries

Workers lease jobs for two minutes. Only a matching unexpired lease can finish a review. The server computes owner, amount, eligibility and limits, and records verifier provenance; the app cannot provide an approval or point amount. Raw photo bytes are downloaded privately, decoded under image-size bounds, and hashed by the worker. Exact duplicates are blocked; near duplicates go to review. Provider responses are schema-checked and inconsistent eligibility flags become review.

Images may contain misleading text. The worker treats image content as untrusted evidence, never instructions. This reduces prompt-injection exposure; it does not make visual verification infallible. AI cannot prove that a photo was not obtained from the internet. Sessions that repeatedly fail verification terminate without points. Review outcomes may require support intervention; production support tooling and appeals remain future work.

The 100-attempt daily worker budget is an application guard, not a currency budget or a provider spending cap. Configure independent provider/project budgets. Hosted JWT/Storage behavior, simultaneous database connections, worker hosting, staff device review and real provider model quality still need acceptance testing.

Official API references: https://platform.openai.com/docs/guides/images-vision and https://platform.openai.com/docs/guides/structured-outputs
