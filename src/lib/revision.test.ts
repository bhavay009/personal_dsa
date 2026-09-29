import { describe, expect, it } from "vitest";
import { nextRevisionLevel, type RevisionEvidence } from "@/lib/revision";

function evidence(overrides: Partial<RevisionEvidence>): RevisionEvidence {
  return {
    currentLevel: 4,
    lastOutcome: "Solved",
    lastMistakeTag: null,
    consecutiveFailuresAtLevel: 0,
    timeTakenMin: null,
    targetMinutes: null,
    lastPredictionCorrect: null,
    ...overrides,
  };
}

describe("nextRevisionLevel", () => {
  // Scenario 1: pattern recall failure — stay at Level 1 until it's remembered.
  it("keeps a failed pattern-recall check at Level 1", () => {
    const { level } = nextRevisionLevel(evidence({ currentLevel: 1, lastOutcome: "Failed" }));
    expect(level).toBe(1);
  });

  // Scenario 2: concept recall failure — stay at Level 2, don't jump ahead to code.
  it("keeps a failed concept-recall check at Level 2", () => {
    const { level } = nextRevisionLevel(evidence({ currentLevel: 2, lastOutcome: "Failed" }));
    expect(level).toBe(2);
  });

  // Scenario 3: implementation (coding) failure on a problem already past recall —
  // routes to Level 3 (reconstruct the algorithm) rather than repeating the solve.
  it("routes a coding-mistake failure at Level 4 down to Level 3", () => {
    const { level } = nextRevisionLevel(
      evidence({ currentLevel: 4, lastOutcome: "Failed", lastMistakeTag: "coding" }),
    );
    expect(level).toBe(3);
  });

  // Scenario 4: transfer failure — the spec's explicit example. Next should be
  // Transfer again, NOT a regression to the original problem.
  it("keeps a failed transfer attempt at Level 6, not back to Level 4", () => {
    const { level } = nextRevisionLevel(evidence({ currentLevel: 6, lastOutcome: "Failed" }));
    expect(level).toBe(6);
  });

  // Scenario 5: speed failure — everything passes but the timed solve is slow.
  // Next should be another timed blind test, not moving on.
  it("repeats the timed blind test when solved but over the target time", () => {
    const { level } = nextRevisionLevel(
      evidence({ currentLevel: 7, lastOutcome: "Solved", timeTakenMin: 40, targetMinutes: 30 }),
    );
    expect(level).toBe(7);
  });

  // Scenario 6: strong performance all the way through — Level 7 solved on pace
  // loops back to a spaced Level 1 recall check rather than stopping.
  it("loops a fast, successful timed test back to Level 1", () => {
    const { level } = nextRevisionLevel(
      evidence({ currentLevel: 7, lastOutcome: "Solved", timeTakenMin: 20, targetMinutes: 30 }),
    );
    expect(level).toBe(1);
  });

  it("advances Level 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 on consecutive solves", () => {
    let level: RevisionEvidence["currentLevel"] = 1;
    const expected = [2, 3, 4, 5, 6, 7];
    for (const next of expected) {
      const result = nextRevisionLevel(evidence({ currentLevel: level, lastOutcome: "Solved" }));
      expect(result.level).toBe(next);
      level = result.level;
    }
  });

  it("does not advance when there has been no attempt yet at the current level", () => {
    const { level } = nextRevisionLevel(evidence({ currentLevel: 4, lastOutcome: null }));
    expect(level).toBe(4);
  });

  it("drops from Level 3 to Level 2 after repeated reconstruction failures", () => {
    const { level } = nextRevisionLevel(
      evidence({ currentLevel: 3, lastOutcome: "Failed", consecutiveFailuresAtLevel: 2 }),
    );
    expect(level).toBe(2);
  });

  it("routes a pattern-recognition mistake tag to Level 1 regardless of current level", () => {
    const { level } = nextRevisionLevel(
      evidence({ currentLevel: 5, lastOutcome: "Failed", lastMistakeTag: "pattern-recognition" }),
    );
    expect(level).toBe(1);
  });

  it("routes a time-management mistake tag to Level 7", () => {
    const { level } = nextRevisionLevel(
      evidence({ currentLevel: 4, lastOutcome: "Failed", lastMistakeTag: "time-management" }),
    );
    expect(level).toBe(7);
  });

  it("routes an algorithm-selection mistake to Level 2 (concept gap, not implementation)", () => {
    const { level } = nextRevisionLevel(
      evidence({ currentLevel: 5, lastOutcome: "Failed", lastMistakeTag: "algorithm-selection" }),
    );
    expect(level).toBe(2);
  });

  it("routes a debugging mistake to Level 4 rather than a full reconstruction", () => {
    const { level } = nextRevisionLevel(
      evidence({ currentLevel: 4, lastOutcome: "Failed", lastMistakeTag: "debugging" }),
    );
    expect(level).toBe(4);
  });

  it("forces Level 1 when the most recent pattern prediction was wrong, even on a solve", () => {
    const { level } = nextRevisionLevel(
      evidence({ currentLevel: 4, lastOutcome: "Solved", lastPredictionCorrect: false }),
    );
    expect(level).toBe(1);
  });
});
