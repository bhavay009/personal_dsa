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

const MIN_EVIDENCE = 3;

// Rough interview-pace targets. Used only to score the speed signal.
const TARGET_MINUTES: Record<string, number> = { Easy: 15, Medium: 30, Hard: 45 };

export type SignalLabel = "strong" | "medium" | "weak" | "no data";

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

function signal(hits: number, total: number): Signal {
  if (total < MIN_EVIDENCE) return { pct: null, evidence: total, label: "no data" };
  const pct = Math.round((hits / total) * 100);
  return { pct, evidence: total, label: pct >= 70 ? "strong" : pct >= 40 ? "medium" : "weak" };
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
