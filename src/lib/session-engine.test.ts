import { describe, expect, it } from "vitest";
import { pickTransferCandidate, type ProblemRow } from "@/lib/session-engine";

function problem(overrides: Partial<ProblemRow> & { id: number; title: string }): ProblemRow {
  return {
    pattern: "Sliding Window",
    difficulty: "Medium",
    status: "Unsolved",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("pickTransferCandidate", () => {
  it("only considers problems of the same pattern", () => {
    const pool = [
      problem({ id: 1, title: "Longest Substring Without Repeating Characters" }),
      problem({ id: 2, title: "Two Sum", pattern: "Hashing" }),
    ];
    const result = pickTransferCandidate(pool, "Sliding Window", {
      excludeIds: new Set(),
      avoidSurfaceTags: new Set(),
      referenceDifficulty: null,
    });
    expect(result?.problem.id).toBe(1);
  });

  it("prefers a different surface than the ones recently seen for this pattern", () => {
    const pool = [
      problem({ id: 1, title: "Longest Substring Without Repeating Characters" }), // string/substring
      problem({ id: 2, title: "Minimum Window Substring" }), // string/substring
      problem({ id: 3, title: "Max Consecutive Ones III" }), // falls outside string/substring
    ];
    const result = pickTransferCandidate(pool, "Sliding Window", {
      excludeIds: new Set(),
      avoidSurfaceTags: new Set(["string/substring"]),
      referenceDifficulty: null,
    });
    expect(result?.problem.id).toBe(3);
    expect(result?.sameSurface).toBe(false);
  });

  it("excludes recently-attempted and same-problem ids (recency + duplicate exclusion)", () => {
    const pool = [
      problem({ id: 1, title: "Longest Substring Without Repeating Characters" }),
      problem({ id: 2, title: "Minimum Window Substring" }),
    ];
    const result = pickTransferCandidate(pool, "Sliding Window", {
      excludeIds: new Set([1]), // id 1 = recently attempted / the triggering problem itself
      avoidSurfaceTags: new Set(),
      referenceDifficulty: null,
    });
    expect(result?.problem.id).toBe(2);
  });

  it("returns null rather than a fabricated candidate when everything is excluded", () => {
    const pool = [problem({ id: 1, title: "Longest Substring Without Repeating Characters" })];
    const result = pickTransferCandidate(pool, "Sliding Window", {
      excludeIds: new Set([1]),
      avoidSurfaceTags: new Set(),
      referenceDifficulty: null,
    });
    expect(result).toBeNull();
  });

  it("prefers a difficulty within one step of the reference difficulty", () => {
    const pool = [
      problem({ id: 1, title: "Trivial Window Problem", difficulty: "Hard" }),
      problem({ id: 2, title: "Another Window Problem", difficulty: "Medium" }),
    ];
    const result = pickTransferCandidate(pool, "Sliding Window", {
      excludeIds: new Set(),
      avoidSurfaceTags: new Set(),
      referenceDifficulty: "Easy",
    });
    // Medium is one step from Easy, Hard is two steps — Medium should win.
    expect(result?.problem.id).toBe(2);
  });

  it("relaxes difficulty compatibility rather than returning nothing when no candidate fits", () => {
    const pool = [problem({ id: 1, title: "Only Option", difficulty: "Hard" })];
    const result = pickTransferCandidate(pool, "Sliding Window", {
      excludeIds: new Set(),
      avoidSurfaceTags: new Set(),
      referenceDifficulty: "Easy",
    });
    expect(result?.problem.id).toBe(1);
  });

  it("honestly reports sameSurface when no diverse option exists instead of faking diversity", () => {
    const pool = [problem({ id: 1, title: "Longest Substring Without Repeating Characters" })];
    const result = pickTransferCandidate(pool, "Sliding Window", {
      excludeIds: new Set(),
      avoidSurfaceTags: new Set(["string/substring"]),
      referenceDifficulty: null,
    });
    expect(result?.problem.id).toBe(1);
    expect(result?.sameSurface).toBe(true);
  });
});
