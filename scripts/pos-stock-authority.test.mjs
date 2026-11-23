import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const inventory = readFileSync(new URL("../php-backend/private/routes/inventory-backup.php", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/lib/api/php-client.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/features/pos/app.tsx", import.meta.url), "utf8");

test("inventory adjustments are server-atomic, audited and reject negative manual adjustments", () => {
  assert.match(inventory, /SELECT payload FROM pos_records WHERE resource = 'ingredients' AND id = \\? FOR UPDATE/);
  assert.match(inventory, /insufficient_stock/);
  assert.match(inventory, /ingredient_stock_adjusted/);
  assert.match(client, /adjustIngredientStock/);
});

test("inventory UI adopts the canonical stock value returned by MySQL", () => {
  assert.match(app, /adjustCentralStock<typeof ingredients\\[number\\]>\\(id,direction\\*amount,commit\\)/);
  assert.doesNotMatch(app, /saveCentralRecord\\("ingredients",\\s*next/);
});
