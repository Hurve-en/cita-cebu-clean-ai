# Supabase Auth acceptance checklist

This patch is prepared for `feat/supabase-auth`. Do not mark hosted Auth or device
acceptance complete from mocked test results.

## Setup

1. Merge patch files at the repository root; preserve files absent from the ZIP.
   Existing package.json and package-lock.json remain unchanged; the required client,
   URL polyfill and SQLite packages are already dependencies.
2. In the root .env, add EXPO_PUBLIC_SUPABASE_URL and
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the same deployed Supabase project.
   Use a publishable key (sb_publishable_...), not a secret/service-role key or private
   database URL. Preserve any existing environment entries. Backend secrets stay in
   backend/.env. Restart Expo after changing public environment variables.
3. Supabase Dashboard: enable email/password signup and Confirm email. Set minimum
   password length to at least 12. Under Authentication email templates, replace the
   Confirm signup body with docs/auth/confirm-signup.html and Reset password body
   with docs/auth/reset-password.html. Keep {{ .Token }} literal. Save both templates.
4. Check the project's SMTP/test-recipient restrictions and email rate limits. Public
   launch requires a configured mail provider and abuse controls. Do not put SMTP
   credentials into Expo variables. This patch does not configure the remote project.
5. For staff accounts, enable the Supabase TOTP MFA enrollment/verification settings.
   No real staff users are seeded; provision through the later reviewed workflow.
6. Run npx expo lint, npx tsc --noEmit and
   node --test test/auth.test.cjs test/resident-store.test.cjs test/officer-service.test.cjs.
7. Run npx expo start --clear, then test in the project's existing development build.
   New routes may require restarting Expo to refresh generated route types.

No db:generate, db:stage or db push is required by this patch.

## Manual checks (all pending)

- [ ] Register a controlled real email. It creates a resident only; no role selector.
- [ ] Verify the emailed code. Wrong, expired and reused codes fail honestly.
- [ ] Existing-email signup does not falsely claim account creation; login/recovery works.
- [ ] Login with wrong password fails; no preview profile or ready workspace is created.
- [ ] Correct login loads the real display name and database-derived resident role.
- [ ] Save a new display name, restart the app, and confirm it persists on the server.
- [ ] A selected enabled barangay persists through update_own_profile. If no barangays
      are configured, show the empty state rather than fabricated community options.
- [ ] Change the same profile from another session; a stale update displays a conflict.
- [ ] Force-close and reopen: the real session restores without flashing preview data.
- [ ] Recovery email sends a code. Only a successful recovery code permits changing
      the password; manipulating mode parameters does not open an authorized reset.
- [ ] Complete recovery and verify old password fails/new password succeeds.
- [ ] Cancel recovery after code verification: this device signs out.
- [ ] Disconnect during sign-out: no false success; retry succeeds after reconnection.
- [ ] Sign out and use back/deep links: previous real workspace content stays protected.
- [ ] A resident cannot open /workspace/officer or /workspace/admin as that role.
- [ ] Disable an account using the approved operator process; foreground/manual access
      refresh blocks the workspace. Raw SQL RLS restrictions still apply independently.
- [ ] A ready assigned officer routes to officer account, requires TOTP enrollment/check,
      and displays the assigned barangay. Test an existing verified factor as well.
- [ ] A ready admin routes to admin account after TOTP verification.
- [ ] An MFA-enrolled resident is challenged at AAL1. Staff and enrolled resident
      recovery flows handle the additional authenticator check before password update.
- [ ] Wrong authenticator codes fail, successful verification reaches AAL2. An abandoned
      enrollment is handled through the documented operator process; no verified factor
      is accidentally deleted by navigation/auth events.
- [ ] While signed in, preview/development routes are unavailable and sample data is absent.
- [ ] While signed out in development, each preview still works and can be exited.
- [ ] In a release build (__DEV__ false), preview routes cannot be opened.
- [ ] Narrow screens, large font, keyboard, navigation/back and loading/error states work.
- [ ] Repeat relevant checks on iOS, Android and web; exports do not replace device tests.

## Evidence from implementation environment

- Root TypeScript and Expo lint pass.
- 13 mocked Auth tests plus 27 resident/officer tests pass (40 total).
- Web server/client export and iOS/Android JavaScript/Hermes exports complete.
- Existing app config points to a missing assets/images/branding/app-icon.png; web
  export warns about the favicon. This pre-existing branding issue is not changed here.
- Live Auth requests, email delivery, real MFA, native installation and device tests have
  not been run. Do not tick the manual checks based on this patch alone.

## Scope to keep explicit

Live reports, schedules, scanner history, rewards and administrative mutations are not
wired into the real workspaces yet. Existing preview screens remain available only for
development exploration. Client MFA gating does not add AAL2 enforcement to the existing
RLS policies. Native SQLite and browser localStorage session persistence require a
pre-release storage/security review; no encrypted SecureStore implementation is included.

The baseline repository also tracks root node_modules. This patch never includes those
files. Clean that history/tracking up in a separate reviewed housekeeping change; adding
a node_modules ignore pattern alone does not untrack existing files.
