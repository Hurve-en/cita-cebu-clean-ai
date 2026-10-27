# Searchable barangay picker

Scope: resident Account details UI, after the Part 5 report-submission patch.

The account form now shows one selected-community field. Opening it displays a
full-screen, keyboard-aware searchable list with alphabetical names, selected-state
radios, clear search, Close, and Choose later. Choosing a row updates the local form;
Save account details still performs the existing authenticated profile mutation.
Closing without choosing leaves the selection unchanged.

The existing service returns only 20 choices per page. While open, the picker loads
remaining enabled barangay pages sequentially through the existing store. Filtering
covers all loaded choices and shows a loading/incomplete message until all pages
have arrived. Failed pagination stops and shows an explicit retry. Closing stops
additional page requests; a request already in flight may finish in the shared
store. Reopening uses the loaded choices. No database, migration or dependency change
is required. The existing session isolation and logout clearing remain in place.

Search ignores case, accents, spaces and punctuation. Alternate spellings from the
supplied Cebu City list match the existing configured name; aliases do not create
additional database rows. Both browsing and matching results are alphabetical.
This local filtering approach targets the current 80-community catalogue. A much
larger or multi-city catalogue should move search/filtering into a scoped server
query rather than preload an unbounded directory. District/city grouping is not
invented: those fields are absent from the current schema.

## Install

Unzip the patch from the repository root, merging files. It includes the current
Part 5 live-ui.tsx, two new picker/search modules and this note. It leaves .env,
auth storage, report submission modules, dependencies and migrations untouched.

```bash
npx expo lint
npx tsc --noEmit
node --test test/auth.test.cjs test/resident-store.test.cjs test/officer-service.test.cjs test/resident-read.test.cjs test/report-submission.test.cjs
npx expo start --clear
```

## Device checks still required

- [ ] Account details shows one field, no long grid/list of barangay buttons.
- [ ] Open and search a choice originally outside the first 20 rows, then save.
- [ ] Search Santo Nino, Camputhaw, Budla-an and Tag-bao: correct existing names appear.
- [ ] Clear search restores alphabetical browsing of all 80 enabled choices.
- [ ] No match shows helpful feedback after loading completes.
- [ ] Select a row: picker closes, field changes, profile is saved only with Save.
- [ ] Reopen and Close/Android Back without choosing: previous selection remains.
- [ ] Choose later clears the local form selection; Cancel/Close alone does not.
- [ ] Disconnect before opening/loading remaining pages: error/retry remains honest.
- [ ] Logout/switch accounts during loading does not retain a previous profile.
- [ ] Test small-screen keyboard, large text, VoiceOver/TalkBack and web keyboard
      navigation. Bundle/type checks do not prove device accessibility.

References: https://reactnative.dev/docs/modal and https://reactnative.dev/docs/flatlist.
