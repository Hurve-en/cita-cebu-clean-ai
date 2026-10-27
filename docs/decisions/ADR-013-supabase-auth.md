# ADR-013: Real authentication separated from development previews

Status: Implementation prepared; hosted Auth and device acceptance pending.
Date: 2026-10-27
Baseline: `ee7fbd1da5762ee4bc5f7725bf75f628184414ef` on `feat/supabase-auth`.

## Problem and scope

The existing login form opens a preview without verifying credentials. Resident
preview records are partitioned by a typed email rather than a trusted Auth UUID.
Treating those records as authenticated data could attribute another person's local
sample history to a real account. This patch never imports preview records into a
real session and never uses client role selection to establish database access.

Supabase Auth handles resident signup, email/password login, email-code verification,
recovery, password changes, session refresh and sign-out on this device. Display names
and selected resident barangays are loaded from public.profiles and updated through
update_own_profile with the expected version. Real roles and eligibility come only
from get_current_access after Auth verifies the stored user with getUser.

No migrations, table grants, API schemas or backend packages change in this patch.
Drizzle continues owning the database schema and reviewed migration generation.
Mobile code uses the Supabase client for Auth and existing RLS-protected queries/RPCs;
private PostgreSQL connections and Drizzle's server client never enter the app bundle.

## Navigation and preview isolation

- Public entry: `/` and `/account`.
- Real authenticated entry: `/workspace`; role-specific screens are
  `/workspace/resident`, `/workspace/officer` and `/workspace/admin`.
- A role mismatch redirects to the verified role's entry. Missing, disabled,
  unverified or otherwise ineligible access displays a blocked account screen.
- Access lookup errors clear ready access and display retry/sign-out controls.
- Original resident tabs/detail, officer screens and admin screen remain development
  previews. `/demo` requires a signed-out session and `__DEV__`. Root protected routes
  additionally require the explicitly selected preview role and matching preview state.
- A real auth event clears preview identities. Live users never enter the resident
  email-keyed local store or the officer demo service. The navigator is not remounted
  on sign-in; recovery form state survives the recovery Auth event.
- Real workspaces show actual account details and clearly describe workflows still
  awaiting backend integration. They do not show sample schedules, reports, points
  or fake administrative mutations as real data.

These guards are navigation controls. RLS and trusted server commands remain the
actual authorization boundary. Removing or modifying a client guard grants no new
SQL permissions.

## Sessions and error handling

The Supabase singleton initializes after the provider mounts, avoiding SSR session
state shared across requests. Its storage key is separate from preview records.
Native session persistence uses Expo SQLite localStorage; web uses browser localStorage.
This is persisted session storage, not encrypted native SecureStore or HttpOnly cookies.
Passwords, codes and authenticator secrets are not stored by app code or logged.
Supabase persists its normal session/user payload, including refresh/access tokens.
A hardened secure-storage strategy and browser XSS/CSP posture remain pre-release work.

Auth callbacks clear ready access immediately and defer SDK calls. Generation checks
reject results arriving after logout, account switching or disposal. Foreground events,
token refresh, initial restoration and manual retry recheck current access. There is no
Realtime push subscription for account revocation. Database RLS rechecks eligibility
on requests; cached client UI can remain visible until the next access check.

Sign-out uses local scope: this device/browser session only. Failed sign-out displays
an error and keeps protected workspace content closed rather than claiming success.
Existing access JWTs on other clients are not globally revoked by this action.

## Verification and recovery

The app uses manually entered email codes, not callback/deep-link sessions. The signup
and reset-password email templates must include `{{ .Token }}`. Provided HTML snippets
are dashboard configuration references, not automatically deployed templates. Email
confirmation must be enabled; provider password minimum should be at least 12 characters.
The UI uses that minimum and matching-password checks; Auth enforces its configured policy.

Signup submits display_name only. It never submits a product role, assignment, enabled
flag or provisioning state. A duplicate/obfuscated signup response does not fabricate a
successful account. Signup codes use verifyOtp type=email; recovery codes use type=recovery.
The password setter requires a successful recovery verification in this form instance
and the same currently verified user. A reset route parameter cannot authorize a password
change. Recovery must be restarted if the form/app is closed; passwords/codes are not
persisted for resumption. Successful recovery leaves the user on the password form until
completion or cancellation, then signs out locally. A password update followed by failed
logout is displayed as a saved password plus an unfinished sign-out, not as a failed update.

Resends enforce a one-minute UI cooldown after successful sends. Supabase rate limits
remain authoritative; no claim is made that a client cooldown prevents abuse. Configure
production SMTP, permitted test recipients, email delivery, rate limits and any required
CAPTCHA before public signup. No SMTP credentials belong in the mobile environment.

## MFA boundary

The UI requires AAL2 for eligible officer/admin workspaces and for residents who already
have an enrolled authenticator. It supports TOTP manual-secret enrollment and challenge
verification. MFA setup secrets are transient and cleared on verification/unmount; no
automatic factor deletion runs during Auth-event cleanup, which could race with successful
verification. Abandoning enrollment can leave an unverified factor in Supabase. Manage
unfinished/lost-factor cleanup and recovery through an approved administrator procedure;
this patch does not implement factor recovery or removal. Staff provisioning is separate.

IMPORTANT: existing database policies do not enforce AAL2. The MFA UI is not proof of
server-enforced staff MFA. Future privileged commands MUST enforce verified AAL2 and
current database eligibility, assignment and audit requirements before exposing staff
mutations. This patch exposes no new staff mutation endpoint. Do not describe the backend
as production-ready or fully MFA-enforced based on these screens.

## Validation

Automated tests cover parsing and contradictory access, public config validation,
MFA gate decisions, checked restoration, blocked eligibility, lookup/identity failures,
stale reads after logout or account switching, failed logout, signup metadata boundaries,
and recovery proof/session binding. The resident/officer suites remain regression checks.
These mocked client tests do not prove signed JWT validation, email delivery, device
persistence, UI navigation timing, MFA enrollment/challenge operation, or remote RLS.

Run root Expo lint, TypeScript and all three test files. Web export checks bundling and
SSR compilation; native JS export checks module resolution but is not a native build.
Complete the manual acceptance list before merging.

## Remaining integration

Live report/media submission, scan persistence, schedule commands, rewards/redemptions,
officer invitations/activation/assignment changes, audit workflows and admin services
remain future slices. Production release also requires hosted Auth/device tests, staff
provisioning/MFA policy enforcement, recovery procedures, secure storage decisions,
SMTP and abuse controls, monitoring, retention and operational verification.

## References

- https://docs.expo.dev/versions/v58.0.0/
- https://docs.expo.dev/guides/using-supabase/
- https://docs.expo.dev/router/advanced/protected/
- https://supabase.com/docs/reference/javascript/auth-verifyotp
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify
