import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTempDb, pointAtTempDb } from "@/lib/test/temp-db";

// Integration test against a real, throwaway SQLite database — regression for a
// bug found during real use: getJourneyDay() used to be `floor((now - firstTopic
// .startedAt) / 1 day) + 1`, i.e. pure calendar time since the first session was
// ever GENERATED. It advanced every calendar day regardless of whether any
// learning work was actually completed, and even advanced from repeated app
// opens / session recomposition. It's now a count of Daily-mode SessionPlans
// that were actually worked through to completion (every block Done or
// Skipped, none Pending) — deliberately NOT `SessionPlan.status`, because
// createSessionPlan silently flips any still-Active plan to "Completed" the
// moment a new one starts, so an abandoned/recomposed session already reads
// "Completed" despite having Pending blocks.

let dbPath: string;
let testPrisma: PrismaClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ dbPath, testPrisma, teardown } = await setupTempDb());
  pointAtTempDb(dbPath);
}, 30_000);

afterAll(async () => {
  await teardown();
});

async function loadCurriculum() {
  return import("@/lib/curriculum");
}

async function makePlan(mode: "Daily" | "OA" | "Blind", blockStatuses: ("Done" | "Skipped" | "Pending")[]) {
  return testPrisma.sessionPlan.create({
    data: {
      mode,
      goalMin: 30,
      blocks: {
        create: blockStatuses.map((status, i) => ({
          position: i,
          kind: "NewProblem",
          minutes: 15,
          rationale: "test block",
          status,
        })),
      },
    },
  });
}

describe("getJourneyDay — actual completed work, not calendar time", () => {
  it("case 1: brand new learner with zero session plans is Day 1", async () => {
    const { getJourneyDay } = await loadCurriculum();
    expect(await getJourneyDay()).toBe(1);
  });

  it("case 2/3: repeated, abandoned Daily plans (some marked Completed by the createSessionPlan side-effect) do not advance the day", async () => {
    const { getJourneyDay } = await loadCurriculum();

    // Simulates opening /today and starting a session three times without ever
    // finishing one — createSessionPlan's own side effect marks the older ones
    // "Completed" purely because a newer plan started, while their blocks stay
    // untouched. This is the exact shape of the real bug.
    const abandoned1 = await makePlan("Daily", ["Pending", "Pending"]);
    await testPrisma.sessionPlan.update({ where: { id: abandoned1.id }, data: { status: "Completed" } });
    const abandoned2 = await makePlan("Daily", ["Pending"]);
    await testPrisma.sessionPlan.update({ where: { id: abandoned2.id }, data: { status: "Completed" } });
    await makePlan("Daily", ["Pending", "Pending", "Pending"]); // the current, still-Active one

    expect(await getJourneyDay()).toBe(1);
  });

  it("case 4: one block done, the rest still pending, does not complete the day", async () => {
    const { getJourneyDay } = await loadCurriculum();
    await makePlan("Daily", ["Done", "Pending"]);
    expect(await getJourneyDay()).toBe(1);
  });

  it("case 5: a Daily plan with every block settled (Done/Skipped, no Pending) advances the day", async () => {
    const { getJourneyDay } = await loadCurriculum();
    await makePlan("Daily", ["Done", "Skipped"]);
    expect(await getJourneyDay()).toBe(2);
  });

  it("case 6: a fully-settled revision-only Daily plan counts the same as any other completed Daily plan", async () => {
    const { getJourneyDay } = await loadCurriculum();
    const plan = await testPrisma.sessionPlan.create({
      data: {
        mode: "Daily",
        goalMin: 20,
        blocks: {
          create: [
            { position: 0, kind: "Revision", minutes: 20, revisionLevel: 4, rationale: "revision only", status: "Done" },
          ],
        },
      },
    });
    expect(plan.mode).toBe("Daily");
    expect(await getJourneyDay()).toBe(3); // day 2 from the previous test's completed plan, +1 for this one
  });

  it("fully-completed Blind/OA plans never count toward the Daily journey day", async () => {
    const { getJourneyDay } = await loadCurriculum();
    const before = await getJourneyDay();
    await makePlan("Blind", ["Done"]);
    await makePlan("OA", ["Done", "Done"]);
    expect(await getJourneyDay()).toBe(before); // unchanged — neither mode is "Daily"
  });

  it("case 7: a manual topic override does not affect the journey day at all", async () => {
    const { getJourneyDay, advanceTopic } = await loadCurriculum();
    const before = await getJourneyDay();
    await testPrisma.curriculumTopic.create({
      data: {
        key: "Override Test Topic",
        name: "Override Test Topic",
        stage: "Foundation",
        order: 999,
        overview: "o",
        whyItMatters: "w",
        coreConcepts: "[]",
        keyPatterns: "[]",
        commonMistakes: "[]",
        interviewClues: "[]",
      },
    });
    await advanceTopic("Override Test Topic", true); // "Move Anyway"
    expect(await getJourneyDay()).toBe(before); // curriculum advancement and learning-day completion are separate
  });
});
