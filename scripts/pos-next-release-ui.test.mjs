import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/components/grill/app.tsx", import.meta.url), "utf8");
const phpApi = readFileSync(new URL("../php-backend/public/api/index.php", import.meta.url), "utf8");

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
  const end = app.indexOf("\nfunction SuppliersScreen", start);
  const reports = app.slice(start, end);
  assert.match(reports, /<div id="print-root"/);
  assert.match(reports, /onClick=\{\(\)=>window\.print\(\)\}/);
});

test("recipe-based cost of goods sold follows weighted ingredient purchase costs", () => {
  const start = phpApi.indexOf("function product_unit_cost(");
  const end = phpApi.indexOf("\nfunction request_json", start);
  const helper = phpApi.slice(start, end);
  assert.match(helper, /if\(!is_array\(\$recipe\)\|\|!\$recipe\)return \$configured/);
  assert.match(helper, /return \$validLines>0\?\(int\)round\(\$total\):\$configured/);
});

test("invoice SMS choice resets to the manager default after each completed order", () => {
  assert.match(app, /setCart\(\[\]\); setCode\(""\); setPoints\(0\); setSendInvoiceSms\(null\); setPrinted\(res\.order\)/);
});

test("expense history can be filtered by selected date range and category", () => {
  assert.match(app, /expenseFilterCategory === "all" \|\| e\.category === expenseFilterCategory/);
  assert.match(app, /value=\{expenseFilterCategory\} onChange=\{e=>setExpenseFilterCategory\(e\.target\.value\)\}/);
});

test("checkout validates normalized Iranian mobile numbers before enrollment", () => {
  assert.ok(app.includes("if (!/^09[0-9]{9}$/.test(normalizedPhone))"));
});

test("expense defaults seed only once and backup restore accepts the seed marker", () => {
  assert.match(phpApi, /resource = 'system_meta' AND id = 'expense_categories_seeded'/);
  assert.match(phpApi, /'sms_logs','system_meta'/);
});

test("complete customer summaries are included in report export beyond the top twenty", () => {
  assert.match(phpApi, /'all_customers'=>\$customerRows/);
  assert.match(app, /allCustomerRows\.map\(row=>\["مشتری"/);
});
