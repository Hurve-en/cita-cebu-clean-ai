/* global __dirname: readonly */
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "cebu-resident-read-"));
for (const name of ["live-model", "live-service", "live-store"]) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/features/resident", name + ".ts"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(output, name + ".js"),
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  );
}
after(() => fs.rmSync(output, { recursive: true, force: true }));
const model = require(path.join(output, "live-model.js")),
  { createResidentReadStore } = require(path.join(output, "live-store.js")),
  { createResidentReadService } = require(path.join(output, "live-service.js"));
const A = "de100000-0000-4000-8000-000000000001",
  B = "de100000-0000-4000-8000-000000000002",
  N = "de000000-0000-4000-8000-000000000001",
  S = "de000000-0000-4000-8000-000000000002",
  ID = "de200000-0000-4000-8000-000000000001";
const time = "2026-10-27T01:00:00.000Z";
const profile = (user = A, patch = {}) => ({
  user_id: user,
  display_name: "Resident",
  resident_barangay_id: N,
  version: 1,
  barangay_name: "North",
  ...patch,
});
const report = (owner = A, patch = {}) => ({
  id: ID,
  created_at: time,
  updated_at: time,
  owner_id: owner,
  original_barangay_id: N,
  title: "Waste concern",
  category_code: "dumping",
  location_text: "North street",
  description: "Test description for this report.",
  status: "pending_review",
  ...patch,
});
const schedule = (barangay = N, patch = {}) => ({
  id: ID,
  created_at: time,
  barangay_id: barangay,
  title: "Collection day",
  stream: "recyclables",
  weekdays: [1, 4],
  start_time: "08:00:00",
  end_time: "10:00:00",
  timezone: "Asia/Manila",
  area: "North street",
  instructions: "Separate recyclables.",
  status: "published",
  ...patch,
});
const event = (patch = {}) => ({
  id: ID,
  created_at: time,
  report_id: ID,
  event_type: "created",
  previous_status: null,
  next_status: "pending_review",
  visibility: "resident",
  note: "Report submitted",
  ...patch,
});
const page = (rows) => ({ rows, more: false });
const tick = () => new Promise((r) => setImmediate(r));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function api(extra = {}) {
  return {
    profile: async (user) => profile(user),
    barangays: async () =>
      page([
        { id: N, name: "North" },
        { id: S, name: "South" },
      ]),
    schedules: async (b) => page([schedule(b)]),
    reports: async (u) => page([report(u)]),
    report: async (u) => report(u),
    events: async () => page([event()]),
    updateProfile: async (u, p, n, b) =>
      profile(u, {
        display_name: n,
        resident_barangay_id: b,
        version: p.version + 1,
      }),
    ...extra,
  };
}
test("row decoders reject foreign ownership, draft/foreign schedules and internal activity", () => {
  assert.throws(() => model.reportRow(report(B), A), /ownership/);
  assert.throws(() => model.scheduleRow(schedule(S), N), /schedule/);
  assert.throws(
    () => model.scheduleRow(schedule(N, { status: "draft" }), N),
    /schedule/,
  );
  assert.throws(
    () =>
      model.eventRow(
        event({ visibility: "internal", event_type: "internal_note" }),
        ID,
      ),
    /activity/,
  );
  assert.throws(() => model.eventRow(event({ report_id: B }), ID), /activity/);
  assert.equal(model.reportRow(report(), A).owner_id, A);
});
test("malformed windows, weekdays, unknown states and oversized response pages fail rather than look empty", () => {
  for (const patch of [
    { weekdays: [] },
    { weekdays: [4, 1] },
    { weekdays: [1, 1] },
    { start_time: "12:00", end_time: "08:00" },
    { timezone: "UTC" },
  ])
    assert.throws(() => model.scheduleRow(schedule(N, patch), N));
  assert.throws(() => model.reportRow(report(A, { status: "approved" }), A));
  assert.throws(() =>
    model.page(new Array(22).fill(report()), (v) => model.reportRow(v, A)),
  );
});
test("cursor values are validated before constructing filters; page sentinel and duplicate merging work", () => {
  assert.throws(() =>
    model.cursorFilter({ id: "x),owner_id.neq.x", created_at: time }, false),
  );
  assert.throws(() =>
    model.cursorFilter({ id: ID, created_at: "bad),id.gt.x" }, false),
  );
  assert.match(
    model.cursorFilter({ id: ID, created_at: time }, false),
    /^created_at.lt./,
  );
  const result = model.page(new Array(21).fill(report()), (v) =>
    model.reportRow(v, A),
  );
  assert.equal(result.rows.length, 20);
  assert.equal(result.more, true);
  assert.deepEqual(model.mergeRows([{ id: A }], [{ id: A }, { id: B }]), [
    { id: A },
    { id: B },
  ]);
});
test("activation loads only the selected identity and community", async () => {
  const store = createResidentReadStore(api());
  store.activate(A);
  await tick();
  assert.equal(store.getSnapshot().owner, A);
  assert.equal(store.getSnapshot().reports.value[0].owner_id, A);
  assert.equal(store.getSnapshot().schedules.value[0].barangay_id, N);
});
test("logout clears all private data and ignores delayed report/profile responses", async () => {
  const p = deferred(),
    r = deferred();
  const store = createResidentReadStore(
    api({ profile: () => p.promise, reports: () => r.promise }),
  );
  store.activate(A);
  store.clear();
  p.resolve(profile());
  r.resolve(page([report()]));
  await tick();
  assert.equal(store.getSnapshot().owner, null);
  assert.equal(store.getSnapshot().profile.value, null);
  assert.deepEqual(store.getSnapshot().reports.value, []);
  assert.deepEqual(store.getSnapshot().schedules.value, []);
});
test("switching identities cannot attach an old response to the next account", async () => {
  const p = deferred();
  const store = createResidentReadStore(
    api({ reports: async (u) => (u === A ? p.promise : page([report(B)])) }),
  );
  store.activate(A);
  store.activate(B);
  await tick();
  p.resolve(page([report(A)]));
  await tick();
  assert.equal(store.getSnapshot().owner, B);
  assert.equal(store.getSnapshot().reports.value[0].owner_id, B);
});
test("community changes invalidate pending old schedules and preserve owned reports", async () => {
  const pending = deferred();
  const store = createResidentReadStore(
    api({
      schedules: async (b) => (b === N ? pending.promise : page([schedule(S)])),
    }),
  );
  store.activate(A);
  await tick();
  await store.saveProfile("Resident", S);
  await tick();
  pending.resolve(page([schedule(N)]));
  await tick();
  assert.equal(store.getSnapshot().profile.value.resident_barangay_id, S);
  assert.equal(store.getSnapshot().schedules.value[0].barangay_id, S);
  assert.equal(store.getSnapshot().reports.value[0].original_barangay_id, N);
});
test("a stale profile reload cannot undo a later successful profile save", async () => {
  const pending = deferred();
  let calls = 0;
  const store = createResidentReadStore(
    api({ profile: async () => (++calls === 1 ? profile() : pending.promise) }),
  );
  store.activate(A);
  await tick();
  const reload = store.reloadProfile();
  await store.saveProfile("Updated name", N);
  pending.resolve(profile());
  await reload;
  assert.equal(store.getSnapshot().profile.value.display_name, "Updated name");
  assert.equal(store.getSnapshot().profile.value.version, 2);
});
test("report list failures display an error instead of a successful empty list", async () => {
  const store = createResidentReadStore(
    api({
      reports: async () => {
        throw Error("Reports unavailable");
      },
    }),
  );
  store.activate(A);
  await tick();
  assert.equal(store.getSnapshot().reports.error, "Reports unavailable");
  assert.equal(store.getSnapshot().reports.loaded, true);
  assert.deepEqual(store.getSnapshot().reports.value, []);
});
test("switching report detail ignores old activity, and closing detail clears it", async () => {
  const pending = deferred();
  const store = createResidentReadStore(
    api({
      report: async (u, id) => report(u, { id }),
      events: async (id) =>
        id === ID ? pending.promise : page([event({ report_id: B })]),
    }),
  );
  store.activate(A);
  await tick();
  await store.openReport(ID);
  await store.openReport(B);
  await tick();
  pending.resolve(page([event()]));
  await tick();
  assert.equal(store.getSnapshot().detail.id, B);
  assert.equal(store.getSnapshot().detail.events.value[0].report_id, B);
  store.closeReport();
  assert.deepEqual(store.getSnapshot().detail.events.value, []);
});
test("load more deduplicates boundaries and failed pagination remains retryable", async () => {
  let calls = 0;
  const store = createResidentReadStore(
    api({
      reports: async () => {
        calls++;
        if (calls === 1) return { rows: [report()], more: true };
        if (calls === 2) throw Error("Offline");
        return page([report(), report(A, { id: B })]);
      },
    }),
  );
  store.activate(A);
  await tick();
  await store.loadReports(true);
  assert.equal(store.getSnapshot().reports.more, true);
  assert.equal(store.getSnapshot().reports.value.length, 1);
  await store.loadReports(true);
  assert.equal(store.getSnapshot().reports.value.length, 2);
  assert.equal(store.getSnapshot().reports.more, false);
});
function queryClient(responses = {}) {
  const calls = [];
  let sessionUser = A;
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: { id: sessionUser },
            access_token: "test-only-token",
          },
        },
        error: null,
      }),
    },
    from(table) {
      const call = { table, steps: [] };
      calls.push(call);
      const q = {
        then(resolve, reject) {
          return Promise.resolve(
            responses[table] ?? { data: [], error: null },
          ).then(resolve, reject);
        },
      };
      for (const name of [
        "select",
        "eq",
        "order",
        "limit",
        "or",
        "gt",
        "single",
        "maybeSingle",
      ])
        q[name] = (...args) => {
          call.steps.push([name, ...args]);
          return q;
        };
      return q;
    },
    rpc(name, args) {
      const call = { rpc: name, args };
      calls.push(call);
      return {
        setHeader(header, value) {
          call.header = { header, value };
          return Promise.resolve({ data: profile(), error: null });
        },
      };
    },
  };
  return {
    client,
    calls,
    switchUser: (user) => {
      sessionUser = user;
    },
  };
}
test("queries specify ownership/community/published filters, deterministic cursor order and bounded pages", async () => {
  const h = queryClient();
  const service = createResidentReadService(h.client);
  await service.reports(A, { id: ID, created_at: time });
  await service.schedules(N);
  await service.events(ID);
  const [r, s, e] = h.calls;
  assert.ok(
    r.steps.some((x) => x[0] === "eq" && x[1] === "owner_id" && x[2] === A),
  );
  assert.ok(r.steps.some((x) => x[0] === "or"));
  assert.ok(
    s.steps.some((x) => x[0] === "eq" && x[1] === "barangay_id" && x[2] === N),
  );
  assert.ok(
    s.steps.some(
      (x) => x[0] === "eq" && x[1] === "status" && x[2] === "published",
    ),
  );
  assert.ok(
    e.steps.some(
      (x) => x[0] === "eq" && x[1] === "visibility" && x[2] === "resident",
    ),
  );
  assert.ok(
    e.steps.some((x) => x[0] === "eq" && x[1] === "report_id" && x[2] === ID),
  );
  for (const c of [r, s, e]) {
    assert.ok(c.steps.some((x) => x[0] === "limit" && x[1] === 21));
    assert.equal(c.steps.filter((x) => x[0] === "order").length, 2);
    assert.ok(!c.steps.find((x) => x[0] === "select")[1].includes("*"));
  }
  assert.ok(!e.steps.find((x) => x[0] === "select")[1].includes("actor_id"));
});
test("direct report and schedule lookups remain scoped and inaccessible IDs return null", async () => {
  const h = queryClient({
      reports: { data: null, error: null },
      collection_schedules: { data: null, error: null },
    }),
    service = createResidentReadService(h.client);
  assert.equal(await service.report(A, ID), null);
  assert.equal(await service.schedule(N, ID), null);
  assert.ok(h.calls[0].steps.some((x) => x[0] === "eq" && x[1] === "owner_id"));
  assert.ok(h.calls[1].steps.some((x) => x[0] === "eq" && x[1] === "status"));
});
test("profile mutation refuses a switched session and pins the correct user token without privileged input", async () => {
  const h = queryClient(),
    service = createResidentReadService(h.client);
  h.switchUser(B);
  await assert.rejects(
    service.updateProfile(A, profile(), "Changed", N),
    /account changed/,
  );
  assert.equal(h.calls.length, 0);
  h.switchUser(A);
  await service.updateProfile(A, profile(), " Changed ", N);
  assert.deepEqual(h.calls[0].args, {
    p_display_name: "Changed",
    p_resident_barangay_id: N,
    p_expected_version: 1,
  });
  assert.equal(h.calls[0].header.header, "Authorization");
  assert.equal(h.calls[0].header.value, "Bearer test-only-token");
});
