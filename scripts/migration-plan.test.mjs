import assert from "node:assert/strict";
import { test } from "node:test";
import { isMigrationFile, migrationName, pendingMigrations } from "./migration-plan.mjs";

test("migration names use the basename", () => {
  assert.equal(migrationName("/migrations/0002_orders.sql"), "0002_orders.sql");
  assert.equal(migrationName("0001_users.sql"), "0001_users.sql");
});

test("only SQL files are migrations", () => {
  assert.equal(isMigrationFile("0001_users.sql"), true);
  assert.equal(isMigrationFile("README.md"), false);
  assert.equal(isMigrationFile("private"), false);
});

test("pending migrations are returned in stable name order", () => {
  assert.deepEqual(
    pendingMigrations(
      ["/migrations/0003_stock.sql", "/migrations/0001_users.sql", "/migrations/0002_orders.sql"],
      ["0001_users.sql"],
    ),
    [
      { name: "0002_orders.sql", path: "/migrations/0002_orders.sql" },
      { name: "0003_stock.sql", path: "/migrations/0003_stock.sql" },
    ],
  );
});

test("already applied migration basenames are never returned twice", () => {
  assert.deepEqual(
    pendingMigrations(["/one/0001_users.sql", "/two/0001_users.sql"], ["0001_users.sql"]),
    [],
  );
});

test("non-SQL directory entries are ignored", () => {
  assert.deepEqual(pendingMigrations(["auth", "README.md"], []), []);
});
