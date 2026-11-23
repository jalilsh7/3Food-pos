import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync(new URL("../src/lib/pos/store.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/features/pos/app.tsx", import.meta.url), "utf8");
const posData = readFileSync(new URL("../src/features/pos/pos-data.ts", import.meta.url), "utf8");

test("POS business state is not persisted through Zustand browser-storage middleware", () => {
  assert.doesNotMatch(store, /zustand\\/middleware|\\bpersist\\s*\\(/);
  assert.match(store, /categories:\\s*\\[\\]/);
  assert.match(store, /products:\\s*\\[\\]/);
  assert.match(store, /orders:\\s*\\[\\]/);
  assert.match(store, /nextOrder:\\s*1/);
  assert.doesNotMatch(store, /resetDemo/);
});

test("the app hydrates role-scoped business data from the PHP/MySQL bootstrap", () => {
  assert.match(app, /phpApi\\.bootstrap<ServerBootstrap>/);
  assert.match(app, /hydratePosFromServer\\(snapshot\\.data, snapshot\\.next_order, role\\)/);
  assert.match(posData, /export function hydratePosFromServer/);
  assert.match(posData, /export function resetPosForRole/);
});

test("legacy data is only read by the explicit one-time migration helper", () => {
  assert.match(posData, /window\\.localStorage\\.getItem\\("grillcash-v1"\\)/);
  assert.match(posData, /export function readLegacyBrowserPosState/);
  assert.match(posData, /smsUser: "",\\s*smsKey: "",\\s*smsFrom: ""/);
  assert.doesNotMatch(app, /window\\.localStorage/);
});
