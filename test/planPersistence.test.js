import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlanPersistence } from "../src/lib/planPersistence.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(options = {}) {
  const events = [];
  const writes = [];
  const store = createPlanPersistence({
    read: async () => ({ value: '{"count":1}', revision: 3 }),
    write: async (value, revision) => { writes.push({ value, revision }); return { revision: revision + 1 }; },
    decode: JSON.parse,
    onData: (data) => events.push(data),
    onState: (state) => events.push(state),
    delay: 10000,
    ...options,
  });
  return { store, writes, events };
}

test("read errors and corrupt data never enable writes; retry loads actual data", async () => {
  let fail = true;
  const { store, writes } = setup({ read: async () => { if (fail) throw new Error("offline"); return { value: '{"count":2}', revision: 7 }; } });
  await store.load();
  store.queue({ count: 0 });
  await store.flush();
  assert.equal(store.getState().status, "load-error");
  assert.equal(writes.length, 0);
  fail = false;
  await store.retry();
  store.queue({ count: 3 });
  await store.flush();
  assert.equal(writes[0].revision, 7);
  store.dispose();
  const corrupt = setup({ read: async () => ({ value: "{invalid", revision: 0 }) });
  await corrupt.store.load();
  corrupt.store.queue({ count: 0 });
  await corrupt.store.flush();
  assert.equal(corrupt.writes.length, 0);
  corrupt.store.dispose();
});

test("pending snapshots are serialized and the newest change uses the next revision", async () => {
  const first = deferred();
  const writes = [];
  const { store } = setup({ write: async (value, revision) => { writes.push({ value, revision }); if (writes.length === 1) return first.promise; return { revision: revision + 1 }; } });
  await store.load();
  store.queue({ count: 2 });
  const saving = store.flush();
  store.queue({ count: 3 });
  store.queue({ count: 4 });
  assert.equal(writes.length, 1);
  first.resolve({ revision: 4 });
  await saving;
  await store.flush();
  assert.deepEqual(writes, [{ value: '{"count":2}', revision: 3 }, { value: '{"count":4}', revision: 4 }]);
  assert.equal(store.getState().dirty, false);
  store.dispose();
});

test("a transient save failure keeps edits pending and a manual retry saves them", async () => {
  let fail = true;
  const { store } = setup({ write: async () => { if (fail) throw new Error("offline"); return { revision: 4 }; } });
  await store.load();
  store.queue({ count: 2 });
  await store.flush();
  assert.equal(store.getState().status, "save-error");
  assert.equal(store.getState().dirty, true);
  fail = false;
  await store.retry();
  assert.equal(store.getState().status, "saved");
  assert.equal(store.getState().dirty, false);
  store.dispose();
});

test("a conflict preserves local edits and never retries against a newer plan", async () => {
  let calls = 0;
  const { store } = setup({ write: async () => { calls++; throw Object.assign(new Error("conflict"), { status: 409 }); } });
  await store.load();
  store.queue({ count: 2 });
  await store.flush();
  store.queue({ count: 3 });
  await store.retry();
  await store.flush();
  assert.equal(calls, 1);
  assert.equal(store.getState().status, "conflict");
  assert.equal(store.getState().dirty, true);
  store.dispose();
});

test("disposed controllers cannot apply a late read or start a write", async () => {
  const read = deferred();
  const { store, events, writes } = setup({ read: () => read.promise });
  const loading = store.load();
  store.dispose();
  read.resolve({ value: '{"count":1}', revision: 0 });
  await loading;
  store.queue({ count: 2 });
  await store.flush();
  assert.equal(writes.length, 0);
  assert.ok(events.every((entry) => entry.count === undefined));
});

test("unsaved browser snapshots recover only after a successful read and keep their original revision on conflict", async () => {
  let cached = { value: '{"count":2}', revision: 2 };
  const { store, writes, events } = setup({ cache: { read: () => cached, write: (value) => { cached = value; }, clear: () => { cached = null; } } });
  await store.load();
  assert.ok(events.some((entry) => entry.count === 2));
  assert.equal(store.getState().status, "conflict");
  store.queue({ count: 4 });
  await store.retry();
  assert.equal(writes.length, 0);
  assert.equal(cached.revision, 2, "reopening must never treat stale edits as based on the new server revision");
  store.dispose();
});

test("a lost write response retries that snapshot before sending newer edits", async () => {
  let calls = 0;
  const writes = [];
  const { store } = setup({ write: async (value, revision) => {
    writes.push({ value, revision });
    if (++calls === 1) throw new Error("response lost");
    return { revision: revision + 1 };
  } });
  await store.load();
  store.queue({ count: 2 });
  await store.flush();
  store.queue({ count: 3 });
  await store.retry();
  await store.flush();
  assert.deepEqual(writes.map((entry) => entry.value), ['{"count":2}', '{"count":2}', '{"count":3}']);
  assert.equal(writes[2].revision, 4);
  store.dispose();
});
