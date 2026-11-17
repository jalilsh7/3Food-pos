import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync(new URL("../src/lib/pos/store.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/components/grill/app.tsx", import.meta.url), "utf8");

test("backup export does not advertise a local-only restore path", () => {
  assert.match(store, /exportBackup:\s*\(\)\s*=>\s*string/);
  assert.doesNotMatch(store, /importBackup/);
  assert.doesNotMatch(app, /importBackup|بازیابی\s*<input/);
  assert.match(app, /بازیابی پشتیبان تا اتصال امن به MySQL غیرفعال است/);
});
