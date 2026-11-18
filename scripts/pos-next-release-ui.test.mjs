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

test("stock shortage warning never disables checkout and can be muted for one hour", () => {
  assert.match(app, /const showStockWarning = stockShortages\.length > 0/);
  assert.match(app, /60 \* 60 \* 1000/);
  assert.match(app, /خاموش‌کردن هشدار برای یک ساعت/);
  assert.match(app, /<Btn onClick=\{checkout\} disabled=\{!cart\.length \|\| submitting\}/);
  assert.match(app, /ثبت سفارش متوقف نمی‌شود/);
});

test("new product form remains ready for consecutive product entry after save", () => {
  assert.match(
    app,
    /if \(ok\) setDraft\(products\.some\(\(item\) => item\.id === draft\.id\) \? null : \{ id: uid\("p"\), name: "", categoryId: draft\.categoryId/,
  );
});

test("Excel-compatible export includes profit and individual expense rows", () => {
  assert.match(app, /\["سود و زیان","سود خالص"/);
  assert.match(app, /expenseItemRows\.map\(row=>\["ریز هزینه"/);
  assert.match(app, /["]مالیات وصول‌شده["]/);
});

test("reports print action targets a visible print root for PDF and paper output", () => {
  const start = app.indexOf("function ReportsScreen()");
  const end = app.indexOf("\\nfunction SuppliersScreen", start);
  const reports = app.slice(start, end);
  assert.match(reports, /<div id="print-root"/);
  assert.match(reports, /onClick=\{\(\)=>window\.print\(\)\}/);
});
