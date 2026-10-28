# Hosted and device acceptance

Local tests passing do not confirm hosted Auth, Storage byte transfer, provider performance or device UX. Complete this list on the real branch/project before calling the branch finished.

- [ ] Both new migrations appear in Local and Remote. The sixteen historical migration files and mappings remain unchanged.
- [ ] Read-only structural verification has the expected grants. No phone role can call the worker verdict or write points directly.
- [ ] Profile shows one History Reports entry. The old reports/history links both open it.
- [ ] Save a scan without submitting. Its original photo and classification remain viewable. It shows Saved draft / 0 points and can be submitted later or removed while unused.
- [ ] Submit an independent photo from the unchanged scanner. Fill the existing action form. There is one history card for that photo, not separate scan and claim cards.
- [ ] Rewards has no Submit a photo action. It shows the current balance, 10-point independent rule, event explanation and daily limits.
- [ ] With automation disabled, the UI says paused; evidence remains pending, and no points are invented. Event submission remains available.
- [ ] With a configured/evaluated private AI worker and automation explicitly enabled, clear eligible independent evidence receives exactly 10 backend points. Refresh/focus the app; Rewards also refreshes every 30 seconds while visible.
- [ ] Repeat the same submission key, retry after a lost response and attempt repeated verification. There is still one ledger credit and one history photo card.
- [ ] Test duplicate images, unclear evidence, loose trash without disposal context, unsafe scenes, edited/downloaded images and screen reproductions. Rejected/uncertain evidence earns zero. Document false approvals/rejections before wider rollout. Internet originality is not proven.
- [ ] Both officer review endpoints reject independent submissions. They cannot serve as an alternative award path.
- [ ] Existing event registration and late saved-photo submission work. Staff still need assignment/MFA and confirmed participation. Event participation earns its configured reward once; event photo cards do not repeat that credit.
- [ ] My Reports waste concerns remain accessible in History Reports, including report text, attachments and public activity. Resolved remains Resolved and earns no fabricated reward points.
- [ ] All / Saved / Submitted filters behave correctly. Older/Newer loads pages of at most 20 items. Retry a failed older page; the current page remains visible.
- [ ] Change accounts or log out during an in-flight history request. No response appears under the next identity.
- [ ] Recover/cancel an interrupted photo upload from history. Original request keys remain stable and retries do not consume another new-upload allowance.
- [ ] The eleventh new media reservation in one Philippine day is blocked by the backend. Cancelling/deleting earlier reservations does not reset that allowance. Existing history and the original request retry still work.
- [ ] Submitted evidence cannot be deleted through the saved-draft control. Removing an unused draft does not affect reports or submitted evidence.
- [ ] On the target iPhone, test small display/larger text, notch/safe-area Back control, form keyboard, slow/offline networking and a large seeded test history. Measure scrolling/memory/latency. Performance remains UNVERIFIED until this device check.
- [ ] Signed-out demo still uses its isolated local records and does not imply real AI rewards or real account writes.

Do not run the local SQL fixtures against hosted Supabase. Use test accounts and real Storage uploads for hosted acceptance. No automated evidence deletion is included.
