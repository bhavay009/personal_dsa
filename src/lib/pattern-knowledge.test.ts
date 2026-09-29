import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTempDb, pointAtTempDb } from "@/lib/test/temp-db";

// Integration tests against a real, throwaway SQLite database (never dev.db) —
// covers §40's "Pattern intelligence: correct canonical knowledge loaded" and
// "AI: malformed structured output is rejected safely" (this app has no live AI
// output, so the equivalent guarantee is that a malformed stored row can't crash
// a read), plus §13's confusion detection built from real evidence.

let dbPath: string;
let testPrisma: PrismaClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ dbPath, testPrisma, teardown } = await setupTempDb());
}, 30_000);

afterAll(async () => {
  await teardown();
});

async function loadPatternKnowledge() {
  pointAtTempDb(dbPath);
  return import("@/lib/pattern-knowledge");
}

describe("getPatternKnowledge", () => {
  it("self-seeds and returns structured, parsed content for a known pattern", async () => {
    const { getPatternKnowledge } = await loadPatternKnowledge();

    const knowledge = await getPatternKnowledge("Sliding Window");

    expect(knowledge).not.toBeNull();
    expect(knowledge!.key).toBe("Sliding Window");
    expect(Array.isArray(knowledge!.signals)).toBe(true);
    expect(knowledge!.signals.length).toBeGreaterThan(0);
    expect(Array.isArray(knowledge!.whenNotToUse)).toBe(true);
    expect(knowledge!.whenNotToUse.length).toBeGreaterThan(0);
    expect(knowledge!.invariant.length).toBeGreaterThan(0);
  });

  it("returns null for a pattern with no canonical knowledge", async () => {
    const { getPatternKnowledge } = await loadPatternKnowledge();
    const knowledge = await getPatternKnowledge("Not A Real Pattern");
    expect(knowledge).toBeNull();
  });

  it("does not crash on a malformed stored JSON field — returns an empty list instead", async () => {
    const { getPatternKnowledge } = await loadPatternKnowledge();
    // Force-seed first, then corrupt one row directly, simulating bad stored data.
    await getPatternKnowledge("Arrays");
    await testPrisma.patternKnowledge.update({
      where: { key: "Arrays" },
      data: { commonTraps: "{not valid json" },
    });

    const knowledge = await getPatternKnowledge("Arrays");
    expect(knowledge).not.toBeNull();
    expect(knowledge!.commonTraps).toEqual([]);
  });
});

describe("detectPatternConfusion", () => {
  it("flags a pair only once it crosses the evidence threshold", async () => {
    const { detectPatternConfusion } = await loadPatternKnowledge();

    const problem = await testPrisma.problem.create({
      data: { title: "Confusable Problem", pattern: "Sliding Window", difficulty: "Medium", status: "Solved" },
    });

    // Two mix-ups: not enough evidence yet.
    for (let i = 0; i < 2; i++) {
      await testPrisma.patternPrediction.create({
        data: { problemId: problem.id, predicted: "Two Pointers", actual: "Sliding Window", correct: false },
      });
    }
    expect(await detectPatternConfusion()).toHaveLength(0);

    // Third mix-up: now it should be flagged.
    await testPrisma.patternPrediction.create({
      data: { problemId: problem.id, predicted: "Two Pointers", actual: "Sliding Window", correct: false },
    });

    const confusions = await detectPatternConfusion();
    expect(confusions).toHaveLength(1);
    expect(confusions[0].count).toBe(3);
    expect([confusions[0].patternA, confusions[0].patternB].sort()).toEqual(["Sliding Window", "Two Pointers"]);
  });
});
