import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/components/grill/app.tsx", import.meta.url), "utf8");

test("customer auto-enrollment reuses a club record after Iranian phone normalization", () => {
  assert.match(app, /function normalizeIranPhone\(value:string\)/);
  assert.match(
    app,
    /customers\.find\(\(item\) => normalizeIranPhone\(item\.phone\) === normalizedPhone\)/,
  );
});

test("invoice SMS remains an optional per-order action with a configurable default", () => {
  assert.match(app, /const shouldSendInvoiceSms = sendInvoiceSms \?\? settings\.invoiceSmsEnabledDefault \?\? false/);
  assert.match(app, /if \(shouldSendInvoiceSms && res\.order\.customerPhone\)/);
  assert.match(app, /postSms\(res\.order\.customerPhone, invoice, "order_invoice"/);
});

test("order list shows the server-created timestamp and elapsed duration", () => {
  assert.match(app, /new Date\(o\.createdAt\)\.toLocaleString\("fa-IR",\{timeZone:"Asia\/Tehran"\}\)/);
  assert.match(app, /formatElapsed\(clockNow-new Date\(o\.createdAt\)\.getTime\(\)\)/);
});
