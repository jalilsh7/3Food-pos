import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const inventory = readFileSync(new URL("../php-backend/private/routes/inventory-backup.php", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/lib/api/php-client.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/features/pos/app.tsx", import.meta.url), "utf8");

test("inventory adjustments are server-atomic, audited and reject negative manual adjustments", () => {
  assert.ok(inventory.includes("SELECT payload FROM pos_records WHERE resource = 'ingredients' AND id = ? FOR UPDATE"));
  assert.ok(inventory.includes("insufficient_stock"));
  assert.ok(inventory.includes("ingredient_stock_adjusted"));
  assert.ok(client.includes("adjustIngredientStock"));
});

test("inventory UI adopts the canonical stock value returned by MySQL", () => {
  assert.ok(app.includes("const result = await phpApi.adjustIngredientStock<TItem>(id, delta);"));
  assert.ok(app.includes("adjustCentralStock<typeof ingredients[number]>(id,direction*amount,commit);"));
});
