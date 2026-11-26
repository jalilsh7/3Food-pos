import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync(new URL("../src/lib/pos/store.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/lib/api/php-client.ts", import.meta.url), "utf8");
const backup = readFileSync(new URL("../php-backend/private/routes/inventory-backup.php", import.meta.url), "utf8");

test("backup export and restore are provided by the authoritative MySQL API", () => {
  assert.doesNotMatch(store, /importBackup|exportBackup|restoreBackup/);
  assert.match(client, /exportBackup: \(\) =>/);
  assert.match(client, /restoreBackup: \(backup: Record<string, unknown>\)/);
  assert.match(backup, /\$path === '\/backup\/export'/);
  assert.match(backup, /\$path === '\/backup\/restore'/);
  assert.match(backup, /restore_requires_empty_pos/);
  assert.match(backup, /order_effects/);
});
