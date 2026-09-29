import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTempDb, pointAtTempDb } from "@/lib/test/temp-db";

// Integration test against a real, throwaway SQLite database — regression for a
// bug found during the UI redesign's browser verification: when every logged
// problem has been attempted recently, composeOaSession's recency exclusion left
// zero candidates and it silently returned an EMPTY block list. The OA page then
// showed "OA simulation in progress" with nothing to do and an immediately
// available "Finish" button (Array.every on [] is vacuously true).

let dbPath: string;
let testPrisma: PrismaClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ dbPath, testPrisma, teardown } = await setupTempDb());
}, 30_000);

afterAll(async () => {
  await teardown();
});

async function loadComposeOaSession() {
  pointAtTempDb(dbPath);
  const mod = await import("@/lib/session-engine");
  return mod.composeOaSession;
}

describe("composeOaSession — recency exhaustion", () => {
  it("still returns at least one block when every problem was attempted recently", async () => {
    const composeOaSession = await loadComposeOaSession();

    const problem = await testPrisma.problem.create({
      data: { title: "Only Problem In The Pool", pattern: "Hashing", difficulty: "Easy", status: "Solved" },
    });
    // Recent attempt — this is exactly what excludes every candidate in the
    // normal recency-exclusion pass.
    await testPrisma.attempt.create({ data: { problemId: problem.id, outcome: "Solved", date: new Date() } });

    const blocks = await composeOaSession(30);

    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0].problemId).not.toBeNull();
    expect(blocks[0].rationale.length).toBeGreaterThan(0);
    // Honest about the fallback, not silent about reusing a recent problem.
    expect(blocks[0].rationale).toMatch(/attempted recently/i);
  });
});
