import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = source("../src/features/pos/app.tsx");
const model = source("../src/lib/pos/model.ts");
const formatters = source("../src/lib/pos/formatters.ts");
const reports = source("../src/features/pos/reports-screen.tsx");
const settings = source("../src/features/pos/settings-screen.tsx");
const createOrder = source("../php-backend/private/routes/orders-create.php");
const editOrder = source("../php-backend/private/routes/orders-edit.php");
const orderStatus = source("../php-backend/private/routes/orders-status.php");
const bootstrap = source("../php-backend/private/routes/records-bootstrap.php");
const receipt = source("../src/features/pos/receipt.tsx");
const receiptQr = source("../src/features/pos/receipt-qr.tsx");
const xlsx = source("../src/lib/xlsx-export.ts");

test("Iranian mobile normalization supports Persian digits and international prefixes", () => {
  assert.match(formatters, /replace\(\/\[۰-۹\]\/g/);
  assert.match(formatters, /replace\(\/\[٠-٩\]\/g/);
  assert.match(formatters, /digits\.startsWith\("\+98"\)/);
  assert.match(formatters, /digits\.startsWith\("0098"\)/);
  assert.match(app, /customers\.find\(\(item\) => normalizeIranPhone\(item\.phone\) === normalizeIranPhone\(value\)\)/);
});

test("invoice SMS is an optional per-order choice with a configurable default", () => {
  assert.match(app, /sendInvoiceSms \?\? settings\.invoiceSmsEnabledDefault \?\? false/);
  assert.match(app, /if \(shouldSendInvoiceSms && order\.customerPhone\)/);
  assert.match(app, /pushSms\("order_invoice", order\.customerPhone, vars\)/);
});

test("stock shortages show a warning but never disable checkout", () => {
  assert.match(app, /const showStockWarning = stockShortages\.length > 0/);
  assert.match(app, /ثبت سفارش متوقف نمی‌شود؛ فروش ادامه پیدا می‌کند و کسری موجودی در انبار ثبت خواهد شد/);
  assert.match(app, /<Btn onClick=\{checkout\} disabled=\{!cart\.length \|\| submitting\}/);
  assert.match(settings, /فروش با هشدار کمبود موجودی/);
  assert.match(settings, /ثبت سفارش متوقف نمی‌شود و کسری در موجودی انبار ثبت خواهد شد/);
  assert.match(model, /stockPolicy: "warn_and_allow"/);
});

test("order creation records negative stock and a reversible ingredient effect", () => {
  assert.match(createOrder, /Stock shortages are warnings only: never block checkout/);
  assert.match(createOrder, /\$ingredient\['stock'\] = round\(\$available - \$needed, 3\)/);
  assert.match(createOrder, /INSERT INTO pos_order_effects/);
  assert.doesNotMatch(createOrder, /stockPolicy === 'block'/);
});

test("order edits reverse the previous active effect before recording its replacement", () => {
  assert.match(editOrder, /WHERE order_id = \? AND reversed_at IS NULL ORDER BY effect_type, resource_id FOR UPDATE/);
  assert.match(editOrder, /UPDATE pos_order_effects SET reversed_at = NOW\(\), reversed_by = \?/);
  assert.match(editOrder, /\$ingredient\['stock'\] = round\(\$available - \$needed, 3\)/);
  assert.match(editOrder, /ON DUPLICATE KEY UPDATE quantity = VALUES\(quantity\)/);
});

test("cancelling an order restores its stock effect even when the balance remains negative", () => {
  assert.match(orderStatus, /\$restoredStock = round\(\(float\)\(\$ingredient\['stock'\] \?\? 0\) \+ \$ingredientQuantities\[\$ingredientId\], 3\)/);
  assert.match(orderStatus, /Negative stock is a valid shortage signal in V2/);
  assert.match(orderStatus, /SET reversed_at = NOW\(\), reversed_by = \? WHERE id IN \(\$marks\) AND reversed_at IS NULL/);
});

test("receipt QR uses the V2-local component and degrades safely for oversized payloads", () => {
  assert.match(receipt, /import \{ ReceiptQr \} from "\.\/receipt-qr"/);
  assert.match(receiptQr, /export function ReceiptQr/);
  assert.match(receiptQr, /A long receipt can exceed the QR standard's maximum payload capacity/);
  assert.match(receiptQr, /متن این فاکتور برای ظرفیت کد QR طولانی است/);
});

test("order timestamps and elapsed durations use Tehran-local formatting", () => {
  assert.match(formatters, /export function tehranDate/);
  assert.match(formatters, /timeZone: "Asia\/Tehran"/);
  assert.match(formatters, /export function formatElapsed/);
  assert.match(app, /formatElapsed\(/);
  assert.match(app, /timeZone:"Asia\/Tehran"/);
});

test("reports provide date-scoped summaries, charts, printing and a native XLSX export", () => {
  assert.match(reports, /phpApi\.getReportSummary\(from,to\)/);
  assert.match(reports, /id="print-root"/);
  assert.match(reports, /نمودار فروش روزانه/);
  assert.match(reports, /نمودار فروش ماهانه/);
  assert.match(reports, /createXlsxBlob\(rows\)/);
  assert.match(xlsx, /export function createXlsxBlob\(rows: unknown\[\]\[\]\): Blob/);
});

test("new product form stays ready for consecutive product entry after save", () => {
  assert.match(app, /setDraft\(products\.some\(\(item\) => item\.id === draft\.id\) \? null : \{ id: uid\("p"\), name: ""/);
});

test("online payment remains unavailable until a real gateway confirms payment", () => {
  assert.match(createOrder, /online_payment_unavailable/);
  assert.match(createOrder, /\['cash','card'\]/);
});

test("kitchen bootstrap exposes only sanitized settings and preparation orders", () => {
  assert.match(bootstrap, /\$resources = \$user\['role'\] === 'kitchen' \? \['settings'\]/);
  assert.match(bootstrap, /\$result = \['settings' => \$result\['settings'\], 'orders' => \$result\['orders'\]\]/);
  assert.match(bootstrap, /customerName.*customerPhone/s);
});
