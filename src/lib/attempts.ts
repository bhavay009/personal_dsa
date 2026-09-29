import { computeSm2Update, outcomeToQuality, prisma, type Outcome } from "@/lib/db";
import { TARGET_MINUTES } from "@/lib/mastery";
import { nextRevisionLevel, type RevisionLevelId, type RevisionOutcome } from "@/lib/revision";

export type AttemptInput = {
  outcome: Outcome | null;
  mistakeTag: string | null;
  timeTakenMin: number | null;
  confidence?: number | null;
};

// Applies one attempt's outcome to a problem's WHEN (SM-2) and WHAT (revision level)
// state. Shared by recordAttempt for both the problem actually being worked on and —
// when this attempt was a Level 5/6 substitute — the original problem whose revision
// progress the outcome counts toward (§8/§9). `updateStatus: false` is used for that
// second case, since the substitute's outcome shouldn't overwrite the original's
// already-correct Solved/Attempted status.
async function applyAttemptToProblem(problemId: number, input: AttemptInput, now: Date, updateStatus: boolean) {
  if (!input.outcome) return;

  const problem = await prisma.problem.findUniqueOrThrow({
    where: { id: problemId },
    select: { easeFactor: true, intervalDays: true, repetitions: true, revisionLevel: true, pattern: true, difficulty: true },
  });

  const quality = outcomeToQuality(input.outcome, input.mistakeTag);
  const sm2 = computeSm2Update(problem, quality, now);

  // The revision-level (WHAT) decision is only meaningful once a problem is coming
  // back around — a problem's very first attempt isn't a "revision" of anything, so
  // Problem.revisionLevel stays at its default (4, Original Problem Re-solve) until
  // then. §9: this is deliberately separate from the SM-2 (WHEN) update above.
  const priorAttemptCount = await prisma.attempt.count({ where: { problemId } });
  const isRevisionAttempt = priorAttemptCount > 0;
  const currentLevel = problem.revisionLevel as RevisionLevelId;

  let nextLevel = currentLevel;
  if (isRevisionAttempt) {
    const [recentAtLevel, latestPrediction] = await Promise.all([
      prisma.attempt.findMany({
        where: { problemId, revisionLevel: currentLevel },
        orderBy: { date: "desc" },
        take: 5,
        select: { outcome: true },
      }),
      prisma.patternPrediction.findFirst({
        where: { problem: { pattern: problem.pattern } },
        orderBy: { createdAt: "desc" },
        select: { correct: true },
      }),
    ]);

    let consecutiveFailuresAtLevel = 0;
    for (const a of recentAtLevel) {
      if (a.outcome === "Solved") break;
      consecutiveFailuresAtLevel++;
    }

    const decision = nextRevisionLevel({
      currentLevel,
      lastOutcome: input.outcome as RevisionOutcome,
      lastMistakeTag: input.mistakeTag,
      consecutiveFailuresAtLevel,
      timeTakenMin: input.timeTakenMin,
      targetMinutes: TARGET_MINUTES[problem.difficulty] ?? 30,
      lastPredictionCorrect: latestPrediction?.correct ?? null,
    });
    nextLevel = decision.level;
  }

  await Promise.all([
    prisma.attempt.create({
      data: {
        problemId,
        date: now,
        outcome: input.outcome,
        mistakeTag: input.mistakeTag,
        timeTakenMin: input.timeTakenMin,
        nextRevision: sm2.nextRevision,
        revisionLevel: isRevisionAttempt ? currentLevel : null,
        confidence: input.confidence ?? null,
      },
    }),
    prisma.problem.update({
      where: { id: problemId },
      data: {
        ...(updateStatus ? { status: input.outcome === "Solved" ? "Solved" : "Attempted" } : {}),
        easeFactor: sm2.easeFactor,
        intervalDays: sm2.intervalDays,
        repetitions: sm2.repetitions,
        revisionLevel: nextLevel,
      },
    }),
  ]);
}

// The DB-writing core of logging an attempt, with no Next.js dependency (no
// revalidatePath) so it can be exercised directly against a real database in tests.
// `revisionTargetId` is set when this attempt was on a Level 5/6 substitute problem
// (§8): the outcome then also advances the ORIGINAL due problem's WHAT/WHEN state,
// via a second Attempt record, without touching the original's already-correct
// status. This is the exact mechanism that was found broken and fixed once already —
// see attempts.test.ts for the regression coverage.
export async function recordAttempt(problemId: number, input: AttemptInput, revisionTargetId?: number | null) {
  if (!input.outcome) return;
  const now = new Date();

  await applyAttemptToProblem(problemId, input, now, true);

  if (revisionTargetId != null && revisionTargetId !== problemId) {
    await applyAttemptToProblem(revisionTargetId, input, now, false);
  }
}
