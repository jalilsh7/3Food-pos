import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync(new URL("../src/lib/pos/store.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/features/pos/app.tsx", import.meta.url), "utf8");
const posData = readFileSync(new URL("../src/features/pos/pos-data.ts", import.meta.url), "utf8");

test("POS business state is not persisted through Zustand browser-storage middleware", () => {
  assert.ok(!store.includes("zustand/middleware"));
  assert.ok(!/\bpersist\s*\(/.test(store));
  for (const key of ["categories: []", "products: []", "orders: []", "nextOrder: 1"]) assert.ok(store.includes(key));
  assert.ok(!store.includes("resetDemo"));
});

test("the app hydrates role-scoped business data from the PHP/MySQL bootstrap", () => {
  assert.ok(app.includes("phpApi.bootstrap<ServerBootstrap>"));
  assert.ok(app.includes("hydratePosFromServer(snapshot.data, snapshot.next_order, role)"));
  assert.ok(posData.includes("export function hydratePosFromServer"));
  assert.ok(posData.includes("export function resetPosForRole"));
});

test("legacy data is only read by the explicit one-time migration helper", () => {
  assert.ok(posData.includes('window.localStorage.getItem("grillcash-v1")'));
  assert.ok(posData.includes("export function readLegacyBrowserPosState"));
  assert.ok(posData.includes('smsUser: "",\n        smsKey: "",\n        smsFrom: "",'));
  assert.ok(!app.includes("window.localStorage"));
});
