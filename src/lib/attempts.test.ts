import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTempDb, pointAtTempDb } from "@/lib/test/temp-db";

// Integration test against a REAL, throwaway SQLite database (never dev.db) — this
// is deliberately not a pure-function test. The bug this guards against (a Level
// 5/6 substitute attempt updating its own card instead of the original due
// problem's) lived entirely in the Prisma read/write glue, which a pure-function
// test of nextRevisionLevel() can't see.

let dbPath: string;
let testPrisma: PrismaClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ dbPath, testPrisma, teardown } = await setupTempDb());
}, 30_000);

afterAll(async () => {
  await teardown();
});

// recordAttempt reads/writes through the module-level `prisma` singleton in
// lib/db.ts, which is bound to DATABASE_URL at import time — so this test points
// the whole process at the temp DB via the env var before importing it, rather
// than trying to inject the test client.
async function loadRecordAttempt() {
  pointAtTempDb(dbPath);
  const mod = await import("@/lib/attempts");
  return mod.recordAttempt;
}

describe("recordAttempt — revision target integrity", () => {
  it("advances the ORIGINAL due problem, not the substitute, when a revisionTargetId is given", async () => {
    const recordAttempt = await loadRecordAttempt();

    const original = await testPrisma.problem.create({
      data: { title: "Original Sliding Window Problem", pattern: "Sliding Window", difficulty: "Medium", status: "Solved", revisionLevel: 6 },
    });
    // The original must already have history for it to be treated as a revision
    // attempt (a problem's very first attempt is never a "revision").
    await testPrisma.attempt.create({
      data: { problemId: original.id, outcome: "Solved", revisionLevel: 5 },
    });

    const substitute = await testPrisma.problem.create({
      data: { title: "Different Surface Problem", pattern: "Sliding Window", difficulty: "Medium", status: "Unsolved", revisionLevel: 4 },
    });

    await recordAttempt(substitute.id, { outcome: "Failed", mistakeTag: null, timeTakenMin: 20 }, original.id);

    const [reloadedOriginal, reloadedSubstitute] = await Promise.all([
      testPrisma.problem.findUniqueOrThrow({ where: { id: original.id } }),
      testPrisma.problem.findUniqueOrThrow({ where: { id: substitute.id } }),
    ]);

    // The original's WHAT-state must reflect the transfer failure: Level 6 failing
    // (no confounding mistake tag) stays at Level 6 — "transfer again", not a
    // regression to the original problem (§8's explicit example).
    expect(reloadedOriginal.revisionLevel).toBe(6);
    expect(reloadedOriginal.status).toBe("Solved"); // untouched — the substitute's outcome doesn't overwrite it

    // The substitute's own card is untouched by the original's revision-level
    // bookkeeping — it's tracked as its own (first) attempt.
    expect(reloadedSubstitute.revisionLevel).toBe(4);
    expect(reloadedSubstitute.status).toBe("Attempted");

    const [originalAttempts, substituteAttempts] = await Promise.all([
      testPrisma.attempt.findMany({ where: { problemId: original.id }, orderBy: { id: "asc" } }),
      testPrisma.attempt.findMany({ where: { problemId: substitute.id } }),
    ]);

    // Two attempt rows on the original: the seeded history one, plus a new one
    // recording THIS transfer attempt's outcome against the original's schedule.
    expect(originalAttempts).toHaveLength(2);
    expect(originalAttempts[1].outcome).toBe("Failed");
    expect(originalAttempts[1].revisionLevel).toBe(6);

    // One attempt row on the substitute, for its own independent history.
    expect(substituteAttempts).toHaveLength(1);
    expect(substituteAttempts[0].outcome).toBe("Failed");
  });

  it("does not touch any other problem when no revisionTargetId is given", async () => {
    const recordAttempt = await loadRecordAttempt();

    const solo = await testPrisma.problem.create({
      data: { title: "Standalone Problem", pattern: "Hashing", difficulty: "Easy", status: "Unsolved" },
    });
    const bystander = await testPrisma.problem.create({
      data: { title: "Bystander Problem", pattern: "Hashing", difficulty: "Easy", status: "Unsolved" },
    });

    await recordAttempt(solo.id, { outcome: "Solved", mistakeTag: null, timeTakenMin: 10 });

    const untouchedBystander = await testPrisma.problem.findUniqueOrThrow({ where: { id: bystander.id } });
    expect(untouchedBystander.status).toBe("Unsolved");
    expect(untouchedBystander.revisionLevel).toBe(4);

    const bystanderAttempts = await testPrisma.attempt.findMany({ where: { problemId: bystander.id } });
    expect(bystanderAttempts).toHaveLength(0);
  });
});
