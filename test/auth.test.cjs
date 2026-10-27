/* global __dirname: readonly */
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "cebuclean-auth-tests-"));
for (const file of ["auth-model", "auth-store", "auth-actions"]) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/features/auth", file + ".ts"),
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
const { parseAccess, needsMfa, publicConfig } = require(
  path.join(output, "auth-model.js"),
);
const { createAuthStore } = require(path.join(output, "auth-store.js"));
const { createAccountActions } = require(path.join(output, "auth-actions.js"));
after(() => fs.rmSync(output, { recursive: true, force: true }));
const access = (id = "user-a", extra = {}) => ({
  user_id: id,
  product_role: "resident",
  enabled: true,
  email_verified: true,
  provisioning_state: "ready",
  eligible: true,
  access_version: 1,
  assigned_barangay_id: null,
  ...extra,
});
const session = (id) => ({ user: { id, email: `${id}@example.test` } });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const tick = () => new Promise((r) => setTimeout(r, 10));
function harness() {
  let current = session("user-a");
  let callback;
  let payload = access();
  const client = {
    auth: {
      getSession: async () => ({ data: { session: current }, error: null }),
      getUser: async () => ({ data: { user: current?.user }, error: null }),
      onAuthStateChange: (fn) => {
        callback = fn;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: async () => {
        current = null;
        callback?.("SIGNED_OUT", null);
        return { error: null };
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1", nextLevel: "aal1" },
          error: null,
        }),
      },
    },
    rpc: async () => ({ data: payload, error: null }),
  };
  return {
    client,
    emit(id, data = access(id)) {
      current = id ? session(id) : null;
      payload = data;
      callback?.(id ? "SIGNED_IN" : "SIGNED_OUT", current);
    },
    setAccess(data) {
      payload = data;
    },
  };
}
test("access decoder rejects identity mismatch, unknown roles, missing or contradictory flags", () => {
  for (const data of [
    null,
    {},
    access("other"),
    access("user-a", { product_role: "owner" }),
    access("user-a", { enabled: false }),
    access("user-a", { email_verified: false }),
    access("user-a", { access_version: 0 }),
    access("user-a", { product_role: "officer" }),
  ]) {
    assert.throws(() => parseAccess(data, "user-a"));
  }
  assert.equal(parseAccess(access(), "user-a").product_role, "resident");
});
test("staff and already-enrolled residents require aal2; ineligible users never become ready through MFA", () => {
  assert.equal(needsMfa(access(), "aal1", "aal1"), false);
  assert.equal(needsMfa(access(), "aal1", "aal2"), true);
  assert.equal(
    needsMfa(access("user-a", { product_role: "admin" }), "aal1", "aal1"),
    true,
  );
  assert.equal(
    needsMfa(access("user-a", { product_role: "admin" }), "aal2", "aal2"),
    false,
  );
  assert.equal(
    needsMfa(access("user-a", { eligible: false }), "aal1", "aal2"),
    false,
  );
});
test("configuration rejects secret keys, credential URLs, insecure URLs and missing values", () => {
  for (const [url, key] of [
    [undefined, undefined],
    ["https://demo.supabase.co", "sb_secret_test"],
    ["http://demo.supabase.co", "sb_publishable_test"],
    ["https://user:pass@demo.supabase.co", "sb_publishable_test"],
  ])
    assert.throws(() => publicConfig(url, key));
  assert.equal(
    publicConfig("https://demo.supabase.co", "sb_publishable_test").url,
    "https://demo.supabase.co",
  );
});
test("stored session is checked against Auth and current access RPC before ready", async () => {
  const h = harness(),
    store = createAuthStore(h.client);
  const stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().phase, "ready");
  assert.equal(store.getSnapshot().access.user_id, "user-a");
  stop();
});
test("unverified or disabled access is blocked rather than routed from user metadata", async () => {
  const h = harness();
  h.setAccess(access("user-a", { eligible: false, enabled: false }));
  const store = createAuthStore(h.client),
    stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().phase, "blocked");
  stop();
});
test("RPC failure and mismatched verified identity fail closed", async () => {
  for (const setup of [
    (h) => {
      h.client.rpc = async () => ({ data: null, error: { code: "42501" } });
    },
    (h) => {
      h.client.auth.getUser = async () => ({
        data: { user: { id: "other" } },
        error: null,
      });
    },
  ]) {
    const h = harness();
    setup(h);
    const store = createAuthStore(h.client),
      stop = store.start();
    await tick();
    assert.equal(store.getSnapshot().phase, "error");
    assert.equal(store.getSnapshot().access, null);
    stop();
  }
});
test("logout invalidates an in-flight permission response", async () => {
  const h = harness(),
    pending = deferred();
  h.client.rpc = () => pending.promise;
  const store = createAuthStore(h.client),
    stop = store.start();
  await tick();
  await store.signOut();
  pending.resolve({ data: access(), error: null });
  await tick();
  assert.equal(store.getSnapshot().phase, "signedOut");
  assert.equal(store.getSnapshot().access, null);
  stop();
});
test("a previous user response cannot replace a later user session", async () => {
  const h = harness(),
    pending = deferred();
  let calls = 0;
  h.client.rpc = async () =>
    ++calls === 1 ? pending.promise : { data: access("user-b"), error: null };
  const store = createAuthStore(h.client),
    stop = store.start();
  await tick();
  h.emit("user-b");
  await tick();
  pending.resolve({ data: access(), error: null });
  await tick();
  assert.equal(store.getSnapshot().access.user_id, "user-b");
  stop();
});
test("failed sign-out does not report signed out or retain ready access", async () => {
  const h = harness(),
    store = createAuthStore(h.client),
    stop = store.start();
  await tick();
  h.client.auth.signOut = async () => ({ error: new Error("offline") });
  await assert.rejects(store.signOut(), /did not complete/);
  assert.equal(store.getSnapshot().phase, "error");
  assert.equal(store.getSnapshot().access, null);
  stop();
});
test("signup normalizes email and submits display name only, never privileged role metadata", async () => {
  let sent;
  const actions = createAccountActions({
    auth: {
      signUp: async (value) => {
        sent = value;
        return { data: { session: null }, error: null };
      },
    },
  });
  await actions.register(
    " Resident ",
    " TEST@EXAMPLE.COM ",
    "long-password-123",
    "long-password-123",
  );
  assert.deepEqual(sent, {
    email: "test@example.com",
    password: "long-password-123",
    options: { data: { display_name: "Resident" } },
  });
});
test("password reset requires successful recovery verification and the same verified user", async () => {
  let updates = 0;
  let id = "user-a";
  const actions = createAccountActions({
    auth: {
      verifyOtp: async () => ({
        data: { user: { id: "user-a" }, session: session("user-a") },
        error: null,
      }),
      getUser: async () => ({ data: { user: { id } }, error: null }),
      updateUser: async () => {
        updates++;
        return { error: null };
      },
    },
  });
  await assert.rejects(
    actions.reset("long-password-123", "long-password-123"),
    /recovery code/,
  );
  await actions.verify("test@example.com", "123456", false);
  await assert.rejects(
    actions.reset("long-password-123", "long-password-123"),
    /recovery code/,
  );
  await actions.verify("test@example.com", "123456", true);
  id = "user-b";
  await assert.rejects(
    actions.reset("long-password-123", "long-password-123"),
    /session changed/,
  );
  assert.equal(updates, 0);
});
test("valid recovery updates once; weak and mismatched passwords never reach Auth", async () => {
  let updates = 0;
  const actions = createAccountActions({
    auth: {
      verifyOtp: async () => ({
        data: { user: { id: "user-a" }, session: session("user-a") },
        error: null,
      }),
      getUser: async () => ({ data: { user: { id: "user-a" } }, error: null }),
      updateUser: async () => {
        updates++;
        return { error: null };
      },
    },
  });
  await actions.verify("test@example.com", "123456", true);
  await assert.rejects(actions.reset("short", "short"), /12 characters/);
  await assert.rejects(
    actions.reset("long-password-123", "different-password"),
    /do not match/,
  );
  await actions.reset("long-password-123", "long-password-123");
  assert.equal(updates, 1);
  await assert.rejects(
    actions.reset("long-password-123", "long-password-123"),
    /recovery code/,
  );
});

test("foreground permission refresh preserves an unfinished MFA form without retaining ready access", async () => {
  const h = harness();
  h.client.auth.mfa.getAuthenticatorAssuranceLevel = async () => ({
    data: { currentLevel: "aal1", nextLevel: "aal2" },
    error: null,
  });
  const store = createAuthStore(h.client),
    stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().phase, "mfa");
  const pending = deferred();
  h.client.auth.getSession = () => pending.promise;
  const checking = store.refresh();
  assert.equal(store.getSnapshot().phase, "loading");
  assert.equal(store.getSnapshot().mfaPending, true);
  assert.equal(store.getSnapshot().access, null);
  pending.resolve({ data: { session: session("user-a") }, error: null });
  await checking;
  assert.equal(store.getSnapshot().phase, "mfa");
  stop();
});
