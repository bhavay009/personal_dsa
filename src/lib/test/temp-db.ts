import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Shared harness for integration tests that need a REAL, throwaway SQLite
// database (never dev.db) — for logic that lives in the Prisma read/write glue
// itself, which pure-function tests can't see.
export async function setupTempDb() {
  const dbDir = mkdtempSync(path.join(os.tmpdir(), "prepos-test-"));
  const dbPath = path.join(dbDir, "test.db");
  const projectRoot = path.resolve(__dirname, "../../..");
  // migrate deploy (not `db push`) — it only applies existing migrations to a
  // fresh database and needs no data-loss flag, unlike `db push`.
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: "pipe",
  });
  const testPrisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }) });

  async function teardown() {
    await testPrisma.$disconnect();
    if (existsSync(dbDir)) rmSync(dbDir, { recursive: true, force: true });
  }

  return { dbPath, testPrisma, teardown };
}

// Modules under test (lib/db.ts) read DATABASE_URL once at import time via a
// module-level singleton, so tests must point the process at the temp DB before
// dynamically importing them, rather than injecting a client.
export function pointAtTempDb(dbPath: string) {
  process.env.DATABASE_URL = `file:${dbPath}`;
}
