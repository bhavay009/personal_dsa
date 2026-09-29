import { getRevisionQueue, prisma } from "@/lib/db";
import { getPatternMastery, signal, type Signal } from "@/lib/mastery";
import { CURRICULUM_TOPICS, type CurriculumTopicSeed } from "@/lib/curriculum-data";

// The Topic Readiness Engine (§14-§19, §35-§36 of the coach spec).
//
// Deterministic, evidence-gated, and deliberately reuses getPatternMastery()
// rather than re-querying Attempt/PatternPrediction from scratch — a
// CurriculumTopic.key IS a Problem.pattern, so its mastery signal already exists.
// Two dimensions (concept, problemSolving) aren't in PatternMastery and are
// derived here from the same underlying data, using the same signal()
// evidence-gating rule so "no data" means the same thing everywhere in the app.
//
// Status is computed live, never stored — only genuine historical facts
// (startedAt, advancedAt, userOverrideAdvanced) live on the CurriculumTopic row.

export type TopicStatus = "MASTERED" | "READY" | "STRONG" | "DEVELOPING" | "LEARNING" | "LOCKED";

export type ReadinessDimension = "concept" | "recognition" | "implementation" | "problemSolving" | "transfer" | "speed" | "retention";

// speed is tracked and shown, but not required to advance (§14: interview pace is
// a refinement, not a gate on whether the underlying skill exists).
const REQUIRED_DIMENSIONS: ReadinessDimension[] = [
  "concept",
  "recognition",
  "implementation",
  "problemSolving",
  "transfer",
  "retention",
];

export type TopicReadiness = {
  key: string;
  name: string;
  stage: string;
  order: number;
  status: TopicStatus;
  startedAt: Date | null;
  advancedAt: Date | null;
  userOverrideAdvanced: boolean;
  dimensions: Record<ReadinessDimension, Signal>;
  gaps: string[]; // human-readable reasons the topic isn't ready, empty when READY/MASTERED
  recommendation: string;
  // Whether at least one of this topic's problems is CURRENTLY due for revision
  // — deliberately independent of `status`. A MASTERED topic can still have this
  // true: advancement and ongoing revision are two separate, unrelated facts,
  // and the UI must not let one imply the other (§ real-learner roadmap review).
  reviewDue: boolean;
  stats: {
    problemsAttempted: number;
    independentSolves: number;
    averageTimeMin: number | null;
    hintsPerProblem: number;
  };
  recentMistakes: string[];
};

const DIMENSION_LABEL: Record<ReadinessDimension, string> = {
  concept: "concept understanding",
  recognition: "pattern recognition",
  implementation: "independent implementation",
  problemSolving: "problem solving",
  transfer: "transfer to new problems",
  speed: "speed",
  retention: "retention",
};

// Ensures the fixed curriculum exists in the DB. Runs once (checked via count),
// self-heals a fresh dev.db without needing a separate seed script/CLI step —
// consistent with this app having no external seeding infrastructure so far.
export async function ensureCurriculumSeeded(): Promise<void> {
  const count = await prisma.curriculumTopic.count();
  if (count > 0) return;
  try {
    await prisma.curriculumTopic.createMany({
      data: CURRICULUM_TOPICS.map((t: CurriculumTopicSeed) => ({
        key: t.key,
        name: t.name,
        stage: t.stage,
        order: t.order,
        prerequisites: t.prerequisites.join(","),
        overview: t.overview,
        whyItMatters: t.whyItMatters,
        coreConcepts: JSON.stringify(t.coreConcepts),
        keyPatterns: JSON.stringify(t.keyPatterns),
        commonMistakes: JSON.stringify(t.commonMistakes),
        interviewClues: JSON.stringify(t.interviewClues),
      })),
    });
  } catch (err) {
    // Two requests can both see count===0 and race to seed (e.g. getCurrentTopic
    // and getCurriculumOverview called together in a Promise.all). If another
    // call already won that race, the unique constraint on `key`/`order` is the
    // signal — not a real failure, just a lost race. Anything else re-throws.
    const isUniqueConstraintViolation =
      err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
    if (!isUniqueConstraintViolation) throw err;
  }
}

// The current topic: the lowest-order topic the user hasn't moved past yet.
// Null only when every topic has been advanced past (curriculum complete).
export async function getCurrentTopic() {
  await ensureCurriculumSeeded();
  return prisma.curriculumTopic.findFirst({
    where: { advancedAt: null },
    orderBy: { order: "asc" },
  });
}

function evidenceGaps(dims: Record<ReadinessDimension, Signal>): string[] {
  const gaps: string[] = [];
  for (const dim of REQUIRED_DIMENSIONS) {
    const s = dims[dim];
    if (s.label === "strong") continue;
    if (s.label === "no data") {
      gaps.push(`no evidence yet for ${DIMENSION_LABEL[dim]}`);
    } else {
      gaps.push(`${DIMENSION_LABEL[dim]} is ${s.label} (${s.pct}% across ${s.evidence} data point${s.evidence === 1 ? "" : "s"})`);
    }
  }
  return gaps;
}

export async function getTopicReadiness(topicKey: string): Promise<TopicReadiness | null> {
  const topic = await prisma.curriculumTopic.findUnique({ where: { key: topicKey } });
  if (!topic) return null;

  const [mastery, problems, attempts, hintEvents, revisionQueue] = await Promise.all([
    getPatternMastery(),
    prisma.problem.findMany({ where: { pattern: topicKey } }),
    prisma.attempt.findMany({
      where: { problem: { pattern: topicKey } },
      orderBy: { date: "asc" },
    }),
    prisma.hintEvent.findMany({ where: { problem: { pattern: topicKey } } }),
    getRevisionQueue(),
  ]);
  const reviewDue = revisionQueue.some((r) => r.problem.pattern === topicKey);

  const patternMastery = mastery.find((m) => m.pattern === topicKey);

  // concept: inverse rate of concept/forgot-concept mistakes among all attempts.
  const conceptMistakes = attempts.filter((a) => a.mistakeTag === "concept" || a.mistakeTag === "forgot-concept").length;
  const concept = signal(attempts.length - conceptMistakes, attempts.length);

  // problemSolving: raw solved rate, independent of hint usage — distinct from
  // "implementation" (mastery.ts), which specifically requires solving WITHOUT a
  // heavy hint. A topic can be "can solve it" (problemSolving) but not yet
  // "can solve it independently" (implementation) — that's a real, useful gap.
  const solved = attempts.filter((a) => a.outcome === "Solved").length;
  const problemSolving = signal(solved, attempts.length);

  const dimensions: Record<ReadinessDimension, Signal> = {
    concept,
    recognition: patternMastery?.recognition ?? { pct: null, evidence: 0, label: "no data" },
    implementation: patternMastery?.implementation ?? { pct: null, evidence: 0, label: "no data" },
    problemSolving,
    transfer: patternMastery?.transfer ?? { pct: null, evidence: 0, label: "no data" },
    speed: patternMastery?.speed ?? { pct: null, evidence: 0, label: "no data" },
    retention: patternMastery?.retention ?? { pct: null, evidence: 0, label: "no data" },
  };

  const gaps = evidenceGaps(dimensions);
  const ready = gaps.length === 0;

  let status: TopicStatus;
  if (topic.advancedAt) status = "MASTERED";
  else if (ready) status = "READY";
  else if (!topic.startedAt && attempts.length === 0) status = "LEARNING";
  else {
    const strongCount = REQUIRED_DIMENSIONS.filter((d) => dimensions[d].label === "strong").length;
    status = strongCount >= Math.ceil(REQUIRED_DIMENSIONS.length / 2) ? "STRONG" : "DEVELOPING";
  }

  const recommendation =
    status === "MASTERED"
      ? `Advanced past ${topic.name}${topic.userOverrideAdvanced ? " (manual override — some evidence gaps remained)" : ""}.`
      : status === "READY"
        ? `READY TO ADVANCE — every required dimension has enough evidence and is strong. Recommendation: move to the next topic.`
        : status === "LEARNING"
          ? `Not started yet. Recommendation: begin with the Learn step for ${topic.name}.`
          : `Recommendation: CONTINUE ${topic.name.toUpperCase()} — ${gaps[0] ?? "still building evidence"}.`;

  const timedAttempts = attempts.filter((a) => a.timeTakenMin != null);
  const averageTimeMin =
    timedAttempts.length > 0
      ? Math.round(timedAttempts.reduce((sum, a) => sum + (a.timeTakenMin ?? 0), 0) / timedAttempts.length)
      : null;

  const recentMistakes = attempts
    .filter((a) => a.mistakeTag)
    .slice(-5)
    .reverse()
    .map((a) => a.mistakeTag as string);

  return {
    key: topic.key,
    name: topic.name,
    stage: topic.stage,
    order: topic.order,
    status,
    startedAt: topic.startedAt,
    advancedAt: topic.advancedAt,
    userOverrideAdvanced: topic.userOverrideAdvanced,
    dimensions,
    gaps,
    recommendation,
    reviewDue,
    stats: {
      problemsAttempted: attempts.length,
      independentSolves: attempts.filter((a) => a.outcome === "Solved").length,
      averageTimeMin,
      hintsPerProblem: problems.length > 0 ? Math.round((hintEvents.length / problems.length) * 10) / 10 : 0,
    },
    recentMistakes,
  };
}

export type CurriculumOverviewTopic = {
  key: string;
  name: string;
  stage: string;
  order: number;
  status: TopicStatus;
  // Advancement was a manual "Move Anyway" rather than the readiness gate
  // actually passing. Only meaningful when status is MASTERED.
  overrideAdvanced: boolean;
  // At least one problem of this topic is due for revision right now —
  // independent of `status`, so the roadmap can't imply "completed" means
  // "nothing left to review here."
  reviewDue: boolean;
};

// The full roadmap (§8): every topic with a live-computed status. Topics past the
// current one are LOCKED — not because they're inaccessible forever, just not
// yet reached in the forward progression (§20: old topics never disappear, they
// stay visible and MASTERED once passed).
export async function getCurriculumOverview(): Promise<CurriculumOverviewTopic[]> {
  await ensureCurriculumSeeded();
  const [topics, revisionQueue] = await Promise.all([
    prisma.curriculumTopic.findMany({ orderBy: { order: "asc" } }),
    getRevisionQueue(),
  ]);
  const duePatterns = new Set(revisionQueue.map((r) => r.problem.pattern));
  const current = topics.find((t) => t.advancedAt === null);

  const results: CurriculumOverviewTopic[] = [];
  for (const topic of topics) {
    const reviewDue = duePatterns.has(topic.key);
    if (topic.advancedAt) {
      results.push({
        key: topic.key,
        name: topic.name,
        stage: topic.stage,
        order: topic.order,
        status: "MASTERED",
        overrideAdvanced: topic.userOverrideAdvanced,
        reviewDue,
      });
      continue;
    }
    if (current && topic.key === current.key) {
      const readiness = await getTopicReadiness(topic.key);
      results.push({
        key: topic.key,
        name: topic.name,
        stage: topic.stage,
        order: topic.order,
        status: readiness?.status ?? "LEARNING",
        overrideAdvanced: false,
        reviewDue,
      });
      continue;
    }
    results.push({
      key: topic.key,
      name: topic.name,
      stage: topic.stage,
      order: topic.order,
      status: "LOCKED",
      overrideAdvanced: false,
      reviewDue,
    });
  }
  return results;
}

// Records that the user has begun engaging with the current topic (first Learn
// view, or first attempt) — a genuine historical fact, not a computed status.
export async function markTopicStarted(topicKey: string): Promise<void> {
  await prisma.curriculumTopic.updateMany({
    where: { key: topicKey, startedAt: null },
    data: { startedAt: new Date() },
  });
}

// Moves past a topic — either because the readiness engine says READY, or
// because the user chose "Move Anyway" (§5, §19). Either way this is the ONLY
// place forward progression happens, and it always records which case it was.
export async function advanceTopic(topicKey: string, override: boolean): Promise<void> {
  await prisma.curriculumTopic.update({
    where: { key: topicKey },
    data: { advancedAt: new Date(), userOverrideAdvanced: override },
  });
}

// Day N of the journey: a count of ACTUALLY COMPLETED Daily sessions, plus one
// — never calendar time elapsed, never how many times a session was generated
// or the app was opened. "Completed" here means every block reached a terminal
// state (Done or Skipped, none Pending) — the exact same condition every Today/
// OA/Blind page already computes client-side as `allSettled` before showing
// "Finish session". Deliberately NOT `SessionPlan.status === "Completed"`:
// createSessionPlan auto-completes any still-Active plan the moment a new one
// starts (see actions.ts), so a plan abandoned mid-session (or superseded by
// "Recompose session") already reads "Completed" in the DB despite having
// Pending blocks — that field alone would silently count abandoned sessions as
// finished. Scoped to mode: "Daily" only — Blind/OA are separate practice
// modes outside the guided curriculum pacing this number represents.
export async function getJourneyDay(): Promise<number> {
  const dailyPlans = await prisma.sessionPlan.findMany({
    where: { mode: "Daily" },
    select: { blocks: { select: { status: true } } },
  });
  const completedDays = dailyPlans.filter(
    (p) => p.blocks.length > 0 && p.blocks.every((b) => b.status !== "Pending"),
  ).length;
  return completedDays + 1;
}

// Curriculum-aware daily plan (§37/§38): wraps composeSession rather than
// re-implementing block selection — the current topic just becomes the
// focus pattern that steers steps 2/4/5 of the existing engine. Starting the
// topic is recorded here, at the moment a real training session is actually
// composed for it (not merely viewed on the Learn card).
export async function composeTodayPlan(goalMin: number) {
  const { composeSession } = await import("@/lib/session-engine");
  const currentTopic = await getCurrentTopic();
  if (!currentTopic) return composeSession(goalMin); // curriculum complete — fall back to generic
  await markTopicStarted(currentTopic.key);
  return composeSession(goalMin, { focusPattern: currentTopic.key });
}

export type TopicPage = {
  readiness: TopicReadiness;
  isCurrent: boolean;
  overview: string;
  whyItMatters: string;
  coreConcepts: string[];
  keyPatterns: string[];
  commonMistakes: string[];
  interviewClues: string[];
};

// Everything the Topic Detail page (§9) needs in one call: computed readiness
// plus the static teaching content stored on the row.
export async function getTopicPage(topicKey: string): Promise<TopicPage | null> {
  const [topic, readiness, current] = await Promise.all([
    prisma.curriculumTopic.findUnique({ where: { key: topicKey } }),
    getTopicReadiness(topicKey),
    getCurrentTopic(),
  ]);
  if (!topic || !readiness) return null;
  return {
    readiness,
    isCurrent: current?.key === topicKey,
    overview: topic.overview,
    whyItMatters: topic.whyItMatters,
    coreConcepts: parseTopicList(topic.coreConcepts),
    keyPatterns: parseTopicList(topic.keyPatterns),
    commonMistakes: parseTopicList(topic.commonMistakes),
    interviewClues: parseTopicList(topic.interviewClues),
  };
}

// The topic immediately after the given order — used to name what "advance"
// actually moves to, on the Topic Detail page's gate.
export async function getNextTopic(afterOrder: number) {
  return prisma.curriculumTopic.findFirst({ where: { order: { gt: afterOrder } }, orderBy: { order: "asc" } });
}

export function parseTopicList(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
