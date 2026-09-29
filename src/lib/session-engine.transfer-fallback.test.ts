import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTempDb, pointAtTempDb } from "@/lib/test/temp-db";

// Integration test against a real, throwaway SQLite database — regression for a
// bug found during real-learner validation: when two patterns tie on priority
// and problem count, composeSession committed to whichever one the tie-break
// happened to pick first for transfer, and gave up on scheduling ANY transfer
// block if that one pattern's only problems had all been attempted recently —
// even when the OTHER tied, transfer-eligible pattern had a genuinely available
// problem to use. A real, available learning opportunity was silently dropped.

let dbPath: string;
let testPrisma: PrismaClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ dbPath, testPrisma, teardown } = await setupTempDb());
}, 30_000);

afterAll(async () => {
  await teardown();
});

async function loadComposeSession() {
  pointAtTempDb(dbPath);
  const mod = await import("@/lib/session-engine");
  return mod.composeSession;
}

// Builds a pattern at APPLIED mastery state: recognition/implementation each
// need >=3 evidence and >=60%/50% respectively; APPLIED needs >=2 distinct
// unaided solves.
async function makeAppliedPattern(pattern: string, problemTitles: string[]) {
  const problems = await Promise.all(
    problemTitles.map((title) => testPrisma.problem.create({ data: { title, pattern, difficulty: "Medium", status: "Solved" } })),
  );
  for (const p of problems) {
    await testPrisma.patternPrediction.create({ data: { problemId: p.id, predicted: pattern, actual: pattern, correct: true } });
  }
  // A 3rd prediction on the first problem to clear the >=3 evidence bar.
  await testPrisma.patternPrediction.create({ data: { problemId: problems[0].id, predicted: pattern, actual: pattern, correct: true } });
  for (const p of problems) {
    await testPrisma.attempt.create({ data: { problemId: p.id, outcome: "Solved", date: new Date(), nextRevision: null } });
  }
  // A 3rd attempt for implementation's evidence bar.
  await testPrisma.attempt.create({ data: { problemId: problems[0].id, outcome: "Solved", date: new Date(), nextRevision: null } });
  return problems;
}

describe("composeSession — transfer fallback across tied patterns", () => {
  it("falls through to a different eligible pattern when the first has no available surface", async () => {
    const composeSession = await loadComposeSession();

    // Pattern A: transfer-eligible, but every one of its problems was JUST
    // attempted (recency-excluded) — no surface available for transfer today.
    await makeAppliedPattern("Hashing", ["Two Sum (Hashing)", "Group Anagrams"]);

    // Pattern B: also transfer-eligible, tied with Pattern A on priority/problem
    // count, but has ONE untouched problem that genuinely could serve as the
    // transfer surface.
    await makeAppliedPattern("Binary Search", ["Binary Search", "Search in Rotated Sorted Array"]);
    const freshSurface = await testPrisma.problem.create({
      data: { title: "Find Peak Element", pattern: "Binary Search", difficulty: "Medium", status: "Unsolved" },
    });

    const blocks = await composeSession(90);

    const transferBlock = blocks.find((b) => b.kind === "Transfer");
    expect(transferBlock).toBeTruthy();
    // Must fall through to Binary Search's available problem, not silently
    // drop transfer because Hashing (tied, but exhausted) was checked first.
    expect(transferBlock!.pattern).toBe("Binary Search");
    expect(transferBlock!.problemId).toBe(freshSurface.id);
  });
});
