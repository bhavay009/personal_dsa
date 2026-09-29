// The 7-level revision hierarchy (§13 of the coach spec).
//
// SM-2 (see lib/db.ts computeSm2Update) already decides WHEN a problem comes back
// around — that's untouched. This module decides WHAT to do with it when it does.
// The two are deliberately kept apart (§9): Problem.easeFactor/intervalDays/
// repetitions is the WHEN state; Problem.revisionLevel is the WHAT state.
//
// The levels are not a fixed 1→7 staircase every problem climbs in order (§7).
// nextRevisionLevel() below is a pure, deterministic function of the last relevant
// attempt's evidence — same idea as SM-2 itself, which also acts on the latest
// review rather than requiring a fixed number of prior reviews.

export type RevisionLevelId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const REVISION_LEVELS: Record<
  RevisionLevelId,
  { name: string; needsCode: boolean; prompt: string }
> = {
  1: { name: "Pattern Recall", needsCode: false, prompt: "What pattern does this problem belong to?" },
  2: { name: "Concept Recall", needsCode: false, prompt: "What is the key idea or invariant behind this pattern?" },
  3: {
    name: "Algorithm Reconstruction",
    needsCode: true,
    prompt: "Without looking at your old solution, explain or write pseudocode for the approach.",
  },
  4: { name: "Original Problem Re-solve", needsCode: true, prompt: "Re-solve this exact problem." },
  5: { name: "Similar Problem", needsCode: true, prompt: "Solve a different problem using the same technique." },
  6: {
    name: "Transfer Problem",
    needsCode: true,
    prompt: "Same underlying pattern, different surface — recognize it unprompted.",
  },
  7: { name: "Timed Blind Test", needsCode: true, prompt: "No hints, no pattern label, timer on." },
};

// A one-line plain-language explanation of each level, for screens that show a
// due revision item without a live session composing around it (e.g. /revise) —
// so "Level 3" never appears without saying what it actually means.
export const LEVEL_EXPLANATION: Record<RevisionLevelId, string> = {
  1: "No code. Just name the pattern before you look at anything else.",
  2: "No code. Explain the underlying idea, not just its name.",
  3: "Reconstruct the algorithm from memory — pseudocode is enough. No solution shown yet.",
  4: "Re-solve the exact problem you saw before, for real this time.",
  5: "Solve a different problem that uses the same technique.",
  6: "Same technique, a deliberately unfamiliar problem — the test is whether you recognize it unprompted.",
  7: "No hints, no pattern label, timer on. This is the closest thing to interview conditions.",
};

export type RevisionOutcome = "Solved" | "Failed" | "Partial";

export type RevisionEvidence = {
  currentLevel: RevisionLevelId;
  // The most recent attempt logged AT currentLevel. Null means the problem hasn't
  // actually been attempted at this level yet (e.g. just entered the queue).
  lastOutcome: RevisionOutcome | null;
  lastMistakeTag: string | null;
  // How many attempts in a row at currentLevel came back Failed/Partial.
  consecutiveFailuresAtLevel: number;
  timeTakenMin: number | null;
  targetMinutes: number | null;
  // Most recent PatternPrediction.correct for this problem's pattern, independent
  // of solve outcome (§5/§11) — a wrong prediction is itself recall evidence.
  lastPredictionCorrect: boolean | null;
};

export function nextRevisionLevel(e: RevisionEvidence): { level: RevisionLevelId; reason: string } {
  const { currentLevel, lastOutcome } = e;

  if (lastOutcome === null) {
    return { level: currentLevel, reason: `Not yet attempted at ${REVISION_LEVELS[currentLevel].name}.` };
  }

  const failed = lastOutcome !== "Solved";

  // Mistake-driven routing (§10) takes priority over the sequential ladder — a
  // concrete signal about WHY it failed is more useful than "try the next rung".
  if (failed && e.lastMistakeTag) {
    const tag = e.lastMistakeTag;
    if (tag === "pattern-recognition") {
      return { level: 1, reason: "Pattern-recognition mistake — drilling pattern recall before anything else." };
    }
    if (tag === "forgot-concept" || tag === "concept") {
      return { level: 2, reason: "Conceptual gap flagged — drilling the underlying idea, not just the pattern name." };
    }
    if (tag === "algorithm-selection") {
      return { level: 2, reason: "Recognized the pattern but picked the wrong technique for it — that's a concept gap, not an implementation one." };
    }
    if ((tag === "coding" || tag === "logic") && currentLevel >= 4) {
      return { level: 3, reason: "Implementation mistake on a problem you can already recognize — reconstruct the algorithm without code first." };
    }
    if (tag === "edge-case") {
      return { level: 4, reason: "Edge-case mistake — re-solve the original problem with edge cases in focus." };
    }
    if (tag === "debugging") {
      return { level: 4, reason: "The approach was right but execution had bugs you couldn't find — re-solve with more care, not a full reconstruction." };
    }
    if (tag === "misread") {
      return { level: 4, reason: "Misread the problem — re-solve it carefully rather than jumping ahead." };
    }
    if (tag === "time-management" || tag === "time-complexity" || tag === "space-complexity") {
      return { level: 7, reason: "Speed/complexity issue — timed blind test until pace is solid." };
    }
    // needed-hint / needed-solution: not a distinct routing signal on their own,
    // fall through to the sequential rule below.
  }

  // A wrong pattern prediction is recall evidence even when unrelated to this
  // attempt's mistake tag — don't let a lucky solve mask a recognition gap.
  if (e.lastPredictionCorrect === false && currentLevel > 2) {
    return { level: 1, reason: "Recent pattern prediction was wrong — recall needs reinforcing before moving on." };
  }

  switch (currentLevel) {
    case 1:
      return failed
        ? { level: 1, reason: "Still can't name the pattern — repeat pattern recall." }
        : { level: 2, reason: "Named the pattern — check the underlying concept next." };
    case 2:
      return failed
        ? { level: 2, reason: "Concept recall failed — repeat before touching code." }
        : { level: 3, reason: "Concept is solid — reconstruct the algorithm without looking it up." };
    case 3:
      if (failed && e.consecutiveFailuresAtLevel >= 2) {
        return { level: 2, reason: "Repeated reconstruction failures — the concept itself needs revisiting." };
      }
      return failed
        ? { level: 3, reason: "Couldn't reconstruct the algorithm — try again before re-solving." }
        : { level: 4, reason: "Can reconstruct the approach — re-solve the original problem." };
    case 4:
      return failed
        ? { level: 4, reason: "Original problem failed again — stay here." }
        : { level: 5, reason: "Re-solved the original — test the technique on a similar problem." };
    case 5:
      return failed
        ? { level: 5, reason: "Similar problem failed — the technique isn't solid enough for transfer yet." }
        : { level: 6, reason: "Similar problem solved — ready to test transfer to a different surface." };
    case 6:
      // Explicit spec example: transfer failure means transfer again, not a
      // regression to the original problem.
      return failed
        ? { level: 6, reason: "Transfer failed — try another different-surface problem, not the original again." }
        : { level: 7, reason: "Transfer succeeded — confirm it holds up under a timed, unaided test." };
    case 7:
      if (failed) {
        return { level: 5, reason: "Timed test failed — rebuild fluency without the clock before retrying." };
      }
      if (e.timeTakenMin != null && e.targetMinutes != null && e.timeTakenMin > e.targetMinutes) {
        return { level: 7, reason: "Solved, but too slow — repeat the timed test until pace is there." };
      }
      return { level: 1, reason: "Fully cleared, on pace — looping back to a spaced recall check." };
  }
}
