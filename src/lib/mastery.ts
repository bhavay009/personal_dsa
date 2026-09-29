import { prisma } from "@/lib/db";
import { HEAVY_HINT_LEVEL } from "@/lib/hints";

// Pattern mastery model (§10).
//
// Two rules drive the design:
//  1. No "Binary Search = 83.72% mastery". Percentages here are training signals
//     used to pick tomorrow's work, not measurements. Every one is shown with the
//     evidence count behind it so a 100% built on 1 attempt reads as what it is.
//  2. §9: a weakness needs multiple supporting observations. Below MIN_EVIDENCE a
//     dimension reports "no data" rather than guessing from one bad day.

export const MIN_EVIDENCE = 3;

// Rough interview-pace targets. Used to score the speed signal, and reused by the
// revision decision engine to judge whether a Level 7 timed solve was fast enough.
export const TARGET_MINUTES: Record<string, number> = { Easy: 15, Medium: 30, Hard: 45 };

export type SignalLabel = "strong" | "developing" | "weak" | "no data";

export type Signal = {
  pct: number | null;
  evidence: number;
  label: SignalLabel;
};

export type MasteryState =
  | "UNKNOWN"
  | "EXPOSED"
  | "RECOGNIZED"
  | "APPLIED"
  | "RETAINED"
  | "TRANSFERRED"
  | "INTERVIEW_READY";

export type PatternMastery = {
  pattern: string;
  state: MasteryState;
  recognition: Signal;
  implementation: Signal;
  speed: Signal;
  retention: Signal;
  transfer: Signal;
  priority: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  problemCount: number;
  solvedCount: number;
};

export function signal(hits: number, total: number): Signal {
  if (total < MIN_EVIDENCE) return { pct: null, evidence: total, label: "no data" };
  const pct = Math.round((hits / total) * 100);
  return { pct, evidence: total, label: pct >= 70 ? "strong" : pct >= 40 ? "developing" : "weak" };
}

export async function getPatternMastery(): Promise<PatternMastery[]> {
  const [problems, attempts, predictions, hintEvents] = await Promise.all([
    prisma.problem.findMany(),
    prisma.attempt.findMany({ orderBy: { date: "asc" } }),
    prisma.patternPrediction.findMany(),
    prisma.hintEvent.findMany(),
  ]);

  const patternOf = new Map(problems.map((p) => [p.id, p.pattern]));
  // Heaviest hint ever taken on a problem — a level-7 hint isn't cancelled out
  // by having also asked for a level-1 one.
  const heaviestHint = new Map<number, number>();
  for (const h of hintEvents) {
    heaviestHint.set(h.problemId, Math.max(heaviestHint.get(h.problemId) ?? 0, h.level));
  }

  const byPattern = new Map<string, typeof problems>();
  for (const p of problems) {
    if (!byPattern.has(p.pattern)) byPattern.set(p.pattern, []);
    byPattern.get(p.pattern)!.push(p);
  }

  const report: PatternMastery[] = [];

  for (const [pattern, patternProblems] of byPattern) {
    const ids = new Set(patternProblems.map((p) => p.id));
    const patternAttempts = attempts.filter((a) => ids.has(a.problemId));
    const patternPredictions = predictions.filter((p) => patternOf.get(p.problemId) === pattern);

    // Recognition: did you name the pattern correctly BEFORE solving? Scored
    // independently of the solve, which is the whole point of §11.
    const recognition = signal(
      patternPredictions.filter((p) => p.correct).length,
      patternPredictions.length,
    );

    // Implementation: solved without needing a heavy hint.
    const solvedAttempts = patternAttempts.filter((a) => a.outcome === "Solved");
    const solvedUnaided = solvedAttempts.filter(
      (a) => (heaviestHint.get(a.problemId) ?? 0) < HEAVY_HINT_LEVEL,
    );
    const implementation = signal(solvedUnaided.length, patternAttempts.length);

    // Speed: of the solves that recorded a time, how many beat the target?
    const timedSolves = solvedAttempts.filter((a) => a.timeTakenMin != null);
    const onPace = timedSolves.filter((a) => {
      const problem = patternProblems.find((p) => p.id === a.problemId);
      const target = TARGET_MINUTES[problem?.difficulty ?? "Medium"] ?? 30;
      return (a.timeTakenMin ?? 0) <= target;
    });
    const speed = signal(onPace.length, timedSolves.length);

    // Retention: performance on attempts that were themselves revisions, i.e.
    // not the first time you saw the problem.
    const firstSeen = new Map<number, number>();
    for (const a of patternAttempts) {
      if (!firstSeen.has(a.problemId)) firstSeen.set(a.problemId, a.id);
    }
    const revisionAttempts = patternAttempts.filter((a) => firstSeen.get(a.problemId) !== a.id);
    const retention = signal(
      revisionAttempts.filter((a) => a.outcome === "Solved").length,
      revisionAttempts.length,
    );

    // Transfer: distinct problems of this pattern solved unaided. Solving the
    // same problem five times proves memory, not transfer — so count problems.
    const distinctSolved = new Set(solvedAttempts.map((a) => a.problemId));
    const distinctUnaided = new Set(solvedUnaided.map((a) => a.problemId));
    const transfer = signal(distinctUnaided.size, distinctSolved.size);

    const state = deriveState({
      attemptCount: patternAttempts.length,
      recognition,
      implementation,
      retention,
      speed,
      distinctSolved: distinctSolved.size,
      distinctUnaided: distinctUnaided.size,
    });

    const dims = { recognition, implementation, speed, retention, transfer };
    const weak = (["recognition", "implementation", "speed", "retention", "transfer"] as const).filter(
      (k) => dims[k].label === "weak",
    );

    const priority: PatternMastery["priority"] =
      weak.length > 0 ? "HIGH" : state === "INTERVIEW_READY" ? "LOW" : "MEDIUM";

    report.push({
      pattern,
      state,
      recognition,
      implementation,
      speed,
      retention,
      transfer,
      priority,
      reason: buildReason({ weak, state, attemptCount: patternAttempts.length, recognition, speed }),
      problemCount: patternProblems.length,
      solvedCount: distinctSolved.size,
    });
  }

  // Weakest-first: that's the order the session engine wants to read it in.
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  report.sort((a, b) => rank[a.priority] - rank[b.priority] || b.problemCount - a.problemCount);
  return report;
}

function deriveState(x: {
  attemptCount: number;
  recognition: Signal;
  implementation: Signal;
  retention: Signal;
  speed: Signal;
  distinctSolved: number;
  distinctUnaided: number;
}): MasteryState {
  if (x.attemptCount === 0) return "UNKNOWN";

  let state: MasteryState = "EXPOSED";
  if ((x.recognition.pct ?? 0) >= 60) state = "RECOGNIZED";
  else return state;

  if (x.distinctSolved >= 2 && (x.implementation.pct ?? 0) >= 50) state = "APPLIED";
  else return state;

  if ((x.retention.pct ?? 0) >= 60) state = "RETAINED";
  else return state;

  if (x.distinctSolved >= 3 && x.distinctUnaided >= 2) state = "TRANSFERRED";
  else return state;

  if ((x.speed.pct ?? 0) >= 60) state = "INTERVIEW_READY";
  return state;
}

function buildReason(x: {
  weak: readonly string[];
  state: MasteryState;
  attemptCount: number;
  recognition: Signal;
  speed: Signal;
}): string {
  if (x.attemptCount === 0) return "No attempts logged yet.";
  if (x.weak.length > 0) {
    const parts = x.weak.map((w) => {
      if (w === "recognition") return `misnamed the pattern in ${100 - (x.recognition.pct ?? 0)}% of predictions`;
      if (w === "speed") return `only ${x.speed.pct}% of solves came in under target time`;
      return `${w} is weak`;
    });
    return `${parts.join("; ")}.`;
  }
  if (x.state === "INTERVIEW_READY") return "Recognition, implementation, retention and speed all clear.";
  if (x.state === "EXPOSED") return "Not enough evidence yet — needs pattern predictions to score recognition.";
  return "Progressing; no weak dimension with enough evidence to act on.";
}

export async function getWeakestPattern(): Promise<PatternMastery | null> {
  const report = await getPatternMastery();
  return report.find((r) => r.priority === "HIGH") ?? report[0] ?? null;
}

// Prediction × outcome cross-analysis. "Recognized correctly" and "solved" are
// different skills, and conflating them hides real signal: someone who names the
// wrong pattern but solves anyway has implementation ahead of recognition, and
// training them with more recognition drills (rather than more recall practice)
// would be wasted time. This is deliberately an OVERALL cross-tab, not per-pattern
// — per-pattern evidence for predictions is almost always too thin to gate on.
//
// Limitation, stated plainly: a PatternPrediction isn't linked to a specific
// Attempt in the schema, so this matches each prediction to the next attempt
// logged on that problem afterward (predictions are always recorded immediately
// before solving, so this is a reliable proxy, not a guess dressed up as data).
export type PredictionCrossTab = {
  correctSolved: number;
  correctFailed: number;
  incorrectSolved: number;
  incorrectFailed: number;
  total: number;
  insight: string | null; // null when there isn't enough evidence to say anything
};

export async function getPredictionCrossTab(): Promise<PredictionCrossTab> {
  const predictions = await prisma.patternPrediction.findMany({ orderBy: { createdAt: "asc" } });
  const empty = { correctSolved: 0, correctFailed: 0, incorrectSolved: 0, incorrectFailed: 0, total: 0, insight: null };
  if (predictions.length === 0) return empty;

  const problemIds = [...new Set(predictions.map((p) => p.problemId))];
  const attempts = await prisma.attempt.findMany({
    where: { problemId: { in: problemIds } },
    orderBy: { date: "asc" },
  });
  const attemptsByProblem = new Map<number, typeof attempts>();
  for (const a of attempts) {
    if (!attemptsByProblem.has(a.problemId)) attemptsByProblem.set(a.problemId, []);
    attemptsByProblem.get(a.problemId)!.push(a);
  }

  let correctSolved = 0;
  let correctFailed = 0;
  let incorrectSolved = 0;
  let incorrectFailed = 0;

  for (const pred of predictions) {
    const followUp = (attemptsByProblem.get(pred.problemId) ?? []).find((a) => a.date >= pred.createdAt);
    if (!followUp) continue; // prediction made, but no attempt logged yet
    const solved = followUp.outcome === "Solved";
    if (pred.correct && solved) correctSolved++;
    else if (pred.correct && !solved) correctFailed++;
    else if (!pred.correct && solved) incorrectSolved++;
    else incorrectFailed++;
  }

  const total = correctSolved + correctFailed + incorrectSolved + incorrectFailed;
  if (total < MIN_EVIDENCE) return { correctSolved, correctFailed, incorrectSolved, incorrectFailed, total, insight: null };

  const incorrectSolvedPct = Math.round((incorrectSolved / total) * 100);
  const correctFailedPct = Math.round((correctFailed / total) * 100);

  let insight: string;
  if (incorrectSolvedPct >= 25) {
    insight = `${incorrectSolvedPct}% of the time you named the wrong pattern but solved anyway — implementation ability is ahead of recognition. Recognition drills matter more than more practice problems right now.`;
  } else if (correctFailedPct >= 25) {
    insight = `${correctFailedPct}% of the time you correctly named the pattern but still couldn't solve it — recognition is ahead of implementation. Reconstruction and practice matter more than recognition drills right now.`;
  } else {
    insight = "Recognition and implementation are roughly in step — no major imbalance in the evidence so far.";
  }

  return { correctSolved, correctFailed, incorrectSolved, incorrectFailed, total, insight };
}

// Hint dependency (§8): reaching for heavy help on most recent problems is a
// distinct failure mode from not solving — it needs its own detector, because
// the attempt log alone shows a healthy "Solved".
export async function getHintDependency(): Promise<{ pct: number; sample: number }> {
  const recent = await prisma.attempt.findMany({ orderBy: { date: "desc" }, take: 10 });
  if (recent.length === 0) return { pct: 0, sample: 0 };

  const hintEvents = await prisma.hintEvent.findMany({
    where: { problemId: { in: recent.map((a) => a.problemId) }, level: { gte: HEAVY_HINT_LEVEL } },
  });
  const leaned = new Set(hintEvents.map((h) => h.problemId));
  const count = recent.filter((a) => leaned.has(a.problemId)).length;
  return { pct: Math.round((count / recent.length) * 100), sample: recent.length };
}

export type ProgressTrend = { label: string; direction: "up" | "down" | "flat" };

// Recent-progress trend for the dashboard: compares the most recent window of
// evidence against the window before it. Only reports a direction when BOTH
// halves clear a minimum sample size — same evidence-gating principle as
// everywhere else, applied to "is this getting better" instead of "what is this
// now". A trend with no clear signal (small change) is omitted rather than
// forced to a direction.
export async function getRecentProgress(): Promise<ProgressTrend[]> {
  const trends: ProgressTrend[] = [];
  const WINDOW = 8;

  // Hint dependency: lower is better.
  const recentAttempts = await prisma.attempt.findMany({ orderBy: { date: "desc" }, take: WINDOW * 2 });
  if (recentAttempts.length >= WINDOW * 2) {
    const recentHalf = recentAttempts.slice(0, WINDOW);
    const priorHalf = recentAttempts.slice(WINDOW, WINDOW * 2);
    const heavyHintRate = async (attempts: typeof recentHalf) => {
      const hintEvents = await prisma.hintEvent.findMany({
        where: { problemId: { in: attempts.map((a) => a.problemId) }, level: { gte: HEAVY_HINT_LEVEL } },
      });
      const leaned = new Set(hintEvents.map((h) => h.problemId));
      return attempts.filter((a) => leaned.has(a.problemId)).length / attempts.length;
    };
    const recentRate = await heavyHintRate(recentHalf);
    const priorRate = await heavyHintRate(priorHalf);
    if (Math.abs(recentRate - priorRate) >= 0.1) {
      trends.push({ label: "Hint dependency", direction: recentRate < priorRate ? "down" : "up" });
    }
  }

  // Pattern recognition: higher is better.
  const recentPredictions = await prisma.patternPrediction.findMany({ orderBy: { createdAt: "desc" }, take: WINDOW * 2 });
  if (recentPredictions.length >= WINDOW * 2) {
    const recentHalf = recentPredictions.slice(0, WINDOW);
    const priorHalf = recentPredictions.slice(WINDOW, WINDOW * 2);
    const recentRate = recentHalf.filter((p) => p.correct).length / recentHalf.length;
    const priorRate = priorHalf.filter((p) => p.correct).length / priorHalf.length;
    if (Math.abs(recentRate - priorRate) >= 0.1) {
      trends.push({ label: "Pattern recognition", direction: recentRate > priorRate ? "up" : "down" });
    }
  }

  // Transfer (Level 6 attempts): higher solve rate is better.
  const transferAttempts = await prisma.attempt.findMany({
    where: { revisionLevel: 6 },
    orderBy: { date: "desc" },
    take: 10,
  });
  if (transferAttempts.length >= 6) {
    const half = Math.floor(transferAttempts.length / 2);
    const recentHalf = transferAttempts.slice(0, half);
    const priorHalf = transferAttempts.slice(half);
    const recentRate = recentHalf.filter((a) => a.outcome === "Solved").length / recentHalf.length;
    const priorRate = priorHalf.filter((a) => a.outcome === "Solved").length / priorHalf.length;
    if (Math.abs(recentRate - priorRate) >= 0.1) {
      trends.push({ label: "Transfer", direction: recentRate > priorRate ? "up" : "down" });
    }
  }

  return trends;
}
