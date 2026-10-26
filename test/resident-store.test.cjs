/* global __dirname: readonly */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
// Uses the project's TypeScript installation; no test dependency is required.
const ts = require("typescript");
const output = fs.mkdtempSync(
  path.join(os.tmpdir(), "cebuclean-record-tests-"),
);
for (const file of ["resident-model", "resident-store"]) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/features/resident", file + ".ts"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(output, file + ".js"),
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  );
}
const { createResidentStore } = require(path.join(output, "resident-store.js"));
const { decodeRecords } = require(path.join(output, "resident-model.js"));
const profile = (email) => ({
  name: "Demo resident",
  email,
  barangay: "Test community",
});
function adapter() {
  const disk = new Map(),
    photos = new Set();
  let count = 0;
  return {
    disk,
    photos,
    read: (key) => disk.get(key) ?? null,
    write: (key, value) => disk.set(key, value),
    savePhoto: async () => {
      const file = `photo-${++count}.jpg`;
      photos.add(file);
      return file;
    },
    deletePhoto: (file) => photos.delete(file),
  };
}
const enter = (store, email = "resident@example.com") =>
  store.dispatch({ type: "enter", profile: profile(email) });
const scan = (id = "scan-1", label = "plastic") => ({
  id,
  label,
  photoUri: "file:///cache/photo.jpg",
});
const report = (photoUri) => ({
  title: "Overflowing bin",
  location: "Test landmark",
  description: "Waste is spilling out of this bin.",
  ...(photoUri ? { photoUri } : {}),
});

test("completed scans survive store recreation and email normalization", async () => {
  const io = adapter(),
    a = createResidentStore(io);
  enter(a, " Resident@Example.com ");
  await a.saveScan(scan());
  const b = createResidentStore(io);
  assert.equal(b.getSnapshot().profile, null);
  enter(b);
  assert.equal(b.getSnapshot().scans.length, 1);
  assert.equal(b.getSnapshot().scans[0].label, "plastic");
});
test("logout hides history; same email restores it; different email stays separate", async () => {
  const a = createResidentStore(adapter());
  enter(a);
  await a.saveScan(scan());
  a.dispatch({ type: "logout" });
  assert.equal(a.getSnapshot().scans.length, 0);
  enter(a, "other@example.com");
  assert.equal(a.getSnapshot().scans.length, 0);
  enter(a);
  assert.equal(a.getSnapshot().scans.length, 1);
});
test("analyze again updates one record and reuses its saved photo", async () => {
  const io = adapter(),
    a = createResidentStore(io);
  enter(a);
  await a.saveScan(scan());
  const before = a.getSnapshot().scans[0];
  await a.saveScan(scan("scan-1", "metal"));
  assert.equal(a.getSnapshot().scans.length, 1);
  assert.equal(io.photos.size, 1);
  assert.equal(a.getSnapshot().scans[0].createdAt, before.createdAt);
  assert.equal(a.getSnapshot().scans[0].label, "metal");
});
test("failed metadata write never reports success and cleans the copied photo", async () => {
  const io = adapter(),
    a = createResidentStore(io);
  enter(a);
  io.write = () => {
    throw new Error("disk full");
  };
  await assert.rejects(a.saveScan(scan()), /disk full/);
  assert.equal(a.getSnapshot().scans.length, 0);
  assert.equal(io.photos.size, 0);
});
test("photo-copy failure saves neither report nor metadata", async () => {
  const io = adapter(),
    a = createResidentStore(io);
  enter(a);
  io.savePhoto = async () => {
    throw new Error("copy failed");
  };
  await assert.rejects(
    a.saveReport(report("file:///cache/report.jpg")),
    /copy failed/,
  );
  assert.equal(a.getSnapshot().reports.length, 0);
  assert.equal(io.disk.size, 0);
});
test("report photo and text are restored together after restart", async () => {
  const io = adapter(),
    a = createResidentStore(io);
  enter(a);
  await a.saveReport(report("file:///cache/report.jpg"));
  const b = createResidentStore(io);
  enter(b);
  assert.equal(b.getSnapshot().reports[0].title, "Overflowing bin");
  assert.match(b.getSnapshot().reports[0].photoFile, /\.jpg$/);
  assert.equal(io.photos.size, 1);
});
test("logout during async save cannot attach a photo to a later session", async () => {
  const io = adapter(),
    a = createResidentStore(io);
  enter(a);
  let finish;
  io.savePhoto = () =>
    new Promise((resolve) => {
      finish = () => {
        io.photos.add("pending.jpg");
        resolve("pending.jpg");
      };
    });
  const pending = a.saveScan(scan());
  a.dispatch({ type: "logout" });
  enter(a, "other@example.com");
  finish();
  await assert.rejects(pending, /session changed/);
  assert.equal(a.getSnapshot().scans.length, 0);
  assert.equal(io.photos.size, 0);
  assert.equal(io.disk.size, 0);
});
test("parallel reports do not overwrite each other", async () => {
  const io = adapter(),
    a = createResidentStore(io);
  enter(a);
  await Promise.all([
    a.saveReport(report("file:///one.jpg")),
    a.saveReport(report("file:///two.jpg")),
  ]);
  assert.equal(a.getSnapshot().reports.length, 2);
  assert.equal(io.photos.size, 2);
});
test("deleting a record removes its photo and persists the deletion", async () => {
  const io = adapter(),
    a = createResidentStore(io);
  enter(a);
  await a.saveScan(scan());
  a.removeScan("scan-1");
  const b = createResidentStore(io);
  enter(b);
  assert.equal(b.getSnapshot().scans.length, 0);
  assert.equal(io.photos.size, 0);
  await a.saveReport(report("file:///r.jpg"));
  a.removeReport(a.getSnapshot().reports[0].id);
  assert.equal(io.photos.size, 0);
});
test("corrupt saved data is preserved and new writes are blocked", async () => {
  const io = adapter(),
    a = createResidentStore(io);
  enter(a);
  await a.saveScan(scan());
  const key = [...io.disk.keys()][0];
  io.disk.set(key, "{corrupt");
  enter(a);
  assert.ok(a.getSnapshot().storageError);
  await assert.rejects(a.saveScan(scan("scan-2")), /could not be loaded/);
  assert.equal(io.disk.get(key), "{corrupt");
});
test("invalid labels and unsafe saved photo paths are rejected", async () => {
  const a = createResidentStore(adapter());
  enter(a);
  await assert.rejects(a.saveScan(scan("x", "hazardous")), /not supported/);
  assert.throws(() =>
    decodeRecords(
      JSON.stringify({
        version: 1,
        reports: [],
        scans: [
          {
            id: "x",
            label: "plastic",
            createdAt: new Date().toISOString(),
            photoFile: "../private.jpg",
          },
        ],
      }),
    ),
  );
});
test("history limit is enforced without discarding existing records", async () => {
  const a = createResidentStore(adapter());
  enter(a);
  for (let i = 0; i < 100; i++) await a.saveScan(scan(`scan-${i}`));
  await assert.rejects(a.saveScan(scan("overflow")), /History is full/);
  assert.equal(a.getSnapshot().scans.length, 100);
});
test("simultaneous saves of the same scan keep one record and one photo", async () => {
  const io = adapter(),
    a = createResidentStore(io);
  enter(a);
  await Promise.all([a.saveScan(scan()), a.saveScan(scan())]);
  assert.equal(a.getSnapshot().scans.length, 1);
  assert.equal(io.photos.size, 1);
});
process.on("exit", () => fs.rmSync(output, { recursive: true, force: true }));
