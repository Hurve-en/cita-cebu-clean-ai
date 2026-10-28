# Private automatic evidence screening

The existing worker is `backend/workers/scan-verifier.mts`; this overlay adds a single-photo branch to it. It is a private Node process, not an Expo screen, SQL-only AI, or a Supabase Edge Function deployment. No paid provider call was made while building/testing this overlay.

Required private process environment variables already used by the worker:

- `REWARDS_SUPABASE_URL`: the HTTPS project URL.
- `REWARDS_SUPABASE_SERVICE_ROLE_KEY`: private server service-role key.
- `OPENAI_API_KEY`: private provider key.
- `REWARDS_VISION_MODEL`: an operator-selected model that supports image input and strict structured JSON via the Responses API. The correct account/model availability and screening accuracy are **UNVERIFIED** here.
- `REWARDS_ALLOW_PAID_VERIFICATION=true`: explicit operator opt-in to provider costs.

Never put these private values into `EXPO_PUBLIC_*`, the mobile `.env`, a public repository, a screenshot or chat. The mobile app retains only its existing public Supabase URL/publishable key. Inject worker secrets using the private host's environment/secret manager. The worker requires the existing root `jpeg-js` dependency as well as backend dependencies; deploy this repository with both installed, or adapt private hosting packaging explicitly. Do not assume a backend-only folder upload has all required image-decoder files.

Once the owner has configured and evaluated the model, the existing private worker command processes one leased item:

```bash
npm run rewards:verify --prefix backend
```

A private supervised process can poll:

```bash
npm run rewards:verify --prefix backend -- --watch
```

Production hosting, restart policy, monitoring and secrets configuration are **UNVERIFIED**. The worker logs generic operational outcomes, not images, prompts or tokens. Its existing global attempt budget and three-attempt lease cap remain. Provider/database failures do not mint points.

After model evaluation and an explicit operator decision to enable automated rewards, run in the private Supabase SQL Editor:

```sql
update public.scan_reward_config
set auto_awards_enabled = true
where id = 1;
```

That setting alone does not run a worker. To pause new single-photo checks again:

```sql
update public.scan_reward_config
set auto_awards_enabled = false
where id = 1;
```

The migration does not enable this flag, configure provider keys, run the paid process, or claim the model proves internet originality. The model only screens visible disposal evidence. Downloaded, edited or photographed-screen images may evade checks; legitimate evidence may be rejected. Default policy rejects ambiguity without officer fallback. This trade-off must be accepted and evaluated before enabling rewards for actual users.
