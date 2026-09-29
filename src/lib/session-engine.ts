import { getRevisionQueue, prisma } from "@/lib/db";
import { getHintDependency, getPatternMastery, TARGET_MINUTES } from "@/lib/mastery";
import { REVISION_LEVELS, type RevisionLevelId } from "@/lib/revision";
import { deriveSurfaceTag } from "@/lib/surface";

// Adaptive session engine (§6, §7).
//
// Deterministic by design. §7 says to use AI only where it adds real value, and
// choosing between "revise" and "drill binary search" is a scheduling decision,
// not a language one — rules make it reproducible, debuggable, and explainable.
// Every block carries a rationale citing the evidence that produced it, so the
// plan can be argued with instead of taken on faith.

export type BlockKind = "Recall" | "Drill" | "NewProblem" | "Transfer" | "Revision" | "Timed";

export type BlockDraft = {
  kind: BlockKind;
  minutes: number;
  pattern: string | null;
  problemId: number | null;
  revisionLevel: RevisionLevelId | null;
  // Set only when problemId is a substitute (Level 5/6 picks a DIFFERENT problem
  // than the one actually due) — the id of the problem whose revision progress this
  // block's outcome should count toward.
  revisionTargetId: number | null;
  rationale: string;
};

const HINT_DEPENDENCY_THRESHOLD = 40; // % of recent problems that needed heavy help
const RECENCY_EXCLUSION_DAYS = 14; // problems attempted this recently are excluded from transfer/similar picks
const MAX_REVISION_BLOCKS_PER_SESSION = 3; // keep revision from crowding out everything else

// Block-kind + minute budget for each of the 7 revision levels (§13).
const REVISION_KIND: Record<RevisionLevelId, BlockKind> = {
  1: "Recall",
  2: "Recall",
  3: "Drill",
  4: "Revision",
  5: "Revision",
  6: "Transfer",
  7: "Timed",
};
const REVISION_MINUTES: Record<RevisionLevelId, number> = {
  1: 8,
  2: 10,
  3: 15,
  4: 20,
  5: 20,
  6: 15,
  7: 25,
};

export async function composeSession(
  goalMin: number,
  opts: { focusPattern?: string | null } = {},
): Promise<BlockDraft[]> {
  const [revisionQueue, mastery, hintDependency, problems, recentAttempts] = await Promise.all([
    getRevisionQueue(),
    getPatternMastery(),
    getHintDependency(),
    prisma.problem.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.attempt.findMany({
      where: { date: { gte: new Date(Date.now() - RECENCY_EXCLUSION_DAYS * 24 * 60 * 60 * 1000) } },
      select: { problemId: true },
    }),
  ]);

  // Cold start: nothing to schedule against. Say so plainly rather than
  // inventing a plan out of no data.
  if (problems.length === 0) {
    return [
      {
        kind: "NewProblem",
        minutes: goalMin,
        pattern: null,
        problemId: null,
        revisionLevel: null,
        revisionTargetId: null,
        rationale:
          "No problems logged yet, so there's nothing to schedule against. Add a few (or import from LeetCode) and the engine starts adapting from your next session.",
      },
    ];
  }

  const recentlyAttemptedIds = new Set(recentAttempts.map((a) => a.problemId));

  const blocks: BlockDraft[] = [];
  let used = 0;
  const remaining = () => goalMin - used;
  const push = (b: BlockDraft) => {
    const minutes = Math.min(b.minutes, remaining());
    if (minutes < 5) return; // sub-5-minute blocks are noise
    blocks.push({ ...b, minutes });
    used += minutes;
  };

  // 1. Revision first (§6/§7/§13). Each due problem carries its own revision level
  //    — WHAT to do with it — decided the last time an attempt on it was logged
  //    (see actions.ts logAttempt / lib/revision.ts). This is not a fixed
  //    sequential ladder: a problem can sit at Level 6 (Transfer) for several
  //    sessions in a row if transfer keeps failing, or jump straight to Level 2 on
  //    a forgotten-concept mistake. The engine here just reads the current level
  //    and builds the right kind of block for it.
  for (const item of revisionQueue.slice(0, MAX_REVISION_BLOCKS_PER_SESSION)) {
    if (remaining() < 5) break;
    const level = item.problem.revisionLevel as RevisionLevelId;
    const meta = REVISION_LEVELS[level];
    const kind = REVISION_KIND[level];
    const minutes = Math.min(REVISION_MINUTES[level], remaining());

    if (level === 5 || level === 6) {
      // These two levels are defined as needing a DIFFERENT problem of the same
      // pattern, not the original one — that's the whole point of "similar" and
      // "transfer" (§6). Level 6 additionally applies the full surface-diversity
      // selection (§12/§3), Level 5 just needs any other same-pattern problem.
      const excludeIds = new Set([...recentlyAttemptedIds, item.problemId]);
      const candidate =
        level === 6
          ? pickTransferCandidate(problems, item.problem.pattern, {
              excludeIds,
              avoidSurfaceTags: recentSurfaceTags(problems, recentAttempts.map((a) => a.problemId), item.problem.pattern),
              referenceDifficulty: item.problem.difficulty,
            })
          : (() => {
              const p = pickProblem(problems, item.problem.pattern, { preferUnsolved: true, exclude: excludeIds });
              return p ? { problem: p, sameSurface: false, noAlternative: false } : null;
            })();

      if (candidate) {
        const surfaceNote =
          level === 6
            ? candidate.sameSurface
              ? " No sufficiently different surface was available — reusing the closest match honestly rather than faking diversity."
              : " Deliberately a different surface than what you've been solving for this pattern."
            : "";
        push({
          kind,
          minutes,
          pattern: item.problem.pattern,
          problemId: candidate.problem.id,
          revisionLevel: level,
          revisionTargetId: item.problemId,
          rationale: `${meta.name} for ${item.problem.pattern} (from "${item.problem.title}").${surfaceNote}`,
        });
      } else {
        // Honesty over a fake block (§4): no other same-pattern problem exists to
        // use, so fall back to the original rather than pretending transfer/similar
        // happened.
        push({
          kind: "Revision",
          minutes,
          pattern: item.problem.pattern,
          problemId: item.problemId,
          revisionLevel: 4,
          revisionTargetId: null,
          rationale: `No other ${item.problem.pattern} problem logged to use for ${meta.name.toLowerCase()} — re-solving the original instead. Log more ${item.problem.pattern} problems to unlock this level properly.`,
        });
      }
      continue;
    }

    push({
      kind,
      minutes,
      pattern: item.problem.pattern,
      // Levels 1/2 still reference the problem (logAttempt needs an id to advance
      // its revision level) even though the UI renders a recall Q&A, not a coding
      // surface, for them.
      problemId: item.problemId,
      revisionLevel: level,
      revisionTargetId: null,
      rationale:
        level <= 2
          ? `${meta.name}: "${item.problem.title}" is due. ${meta.prompt}`
          : `${meta.name} on "${item.problem.title}", due for revision.`,
    });
  }

  // 2. Curriculum mode (§37/§38): the current topic sets the theme instead of
  //    whichever pattern happens to be weakest system-wide. A topic with zero
  //    evidence yet gets a plain practice block — the weak-dimension branching
  //    below only makes sense once there's at least some mastery signal.
  const focusMastery = opts.focusPattern ? mastery.find((m) => m.pattern === opts.focusPattern) : undefined;
  if (opts.focusPattern && !focusMastery && remaining() >= 15) {
    const target = pickProblem(problems, opts.focusPattern, { preferUnsolved: true });
    push({
      kind: "NewProblem",
      minutes: 25,
      pattern: opts.focusPattern,
      problemId: target?.id ?? null,
      revisionLevel: null,
      revisionTargetId: null,
      rationale: `Starting ${opts.focusPattern} — today's current topic, no attempts logged yet.`,
    });
  }

  // 3. The weakest pattern sets the theme (or the current topic, in curriculum
  //    mode). Which block it earns depends on WHICH dimension is weak — a
  //    recognition failure and a speed failure need opposite training, and
  //    treating both as "do more problems" is the reason random practice
  //    plateaus.
  const weakest = focusMastery ?? (opts.focusPattern ? undefined : mastery.find((m) => m.priority === "HIGH"));
  if (weakest && remaining() >= 10) {
    const target = pickProblem(problems, weakest.pattern, { preferUnsolved: true });

    if (weakest.recognition.label === "weak") {
      push({
        kind: "Recall",
        minutes: 10,
        pattern: weakest.pattern,
        problemId: null,
        revisionLevel: null,
        revisionTargetId: null,
        rationale: `Recognition for ${weakest.pattern} is weak (${weakest.recognition.pct}% of ${weakest.recognition.evidence} predictions correct). Name the pattern before writing anything.`,
      });
      push({
        kind: "Drill",
        minutes: 25,
        pattern: weakest.pattern,
        problemId: target?.id ?? null,
        revisionLevel: null,
        revisionTargetId: null,
        rationale: `Targeted ${weakest.pattern} practice while recognition is the bottleneck.`,
      });
    } else if (weakest.speed.label === "weak") {
      push({
        kind: "Timed",
        minutes: 30,
        pattern: weakest.pattern,
        problemId: target?.id ?? null,
        revisionLevel: null,
        revisionTargetId: null,
        rationale: `${weakest.pattern} solves land under target time only ${weakest.speed.pct}% of the time. Hard stop at the buzzer.`,
      });
    } else {
      push({
        kind: "Drill",
        minutes: 30,
        pattern: weakest.pattern,
        problemId: target?.id ?? null,
        revisionLevel: null,
        revisionTargetId: null,
        rationale: opts.focusPattern
          ? `${weakest.pattern} is today's current topic — ${weakest.reason}`
          : `${weakest.pattern} is the weakest tracked pattern — ${weakest.reason}`,
      });
    }
  }

  // 3. Hint dependency is its own failure mode: the attempt log shows "Solved",
  //    but the solve was borrowed. Schedule a deliberate no-help block.
  if (hintDependency.pct >= HINT_DEPENDENCY_THRESHOLD && remaining() >= 15) {
    const target = pickProblem(problems, null, { preferUnsolved: true });
    push({
      kind: "NewProblem",
      minutes: 25,
      pattern: target?.pattern ?? null,
      problemId: target?.id ?? null,
      revisionLevel: null,
      revisionTargetId: null,
      rationale: `${hintDependency.pct}% of your last ${hintDependency.sample} problems needed a heavy hint. No hints for the first 20 minutes of this one.`,
    });
  }

  // 4. Transfer for a pattern that's ready, but isn't already in today's revision
  //    queue (§12). Only worth scheduling once a pattern has actually been
  //    applied — transfer before application is just a second unsolved problem.
  const inRevisionAlready = new Set(revisionQueue.map((r) => r.problem.pattern));
  const transferEligible = (m: (typeof mastery)[number]) =>
    (m.state === "APPLIED" || m.state === "RETAINED") && !inRevisionAlready.has(m.pattern);
  // In curriculum mode, prefer transferring the current topic itself once it
  // qualifies — that's the actual §14 transfer requirement for THIS topic, not
  // a system-wide scan for whatever else happens to be ready. Tries EVERY
  // eligible pattern in order (not just the first) rather than committing to one
  // and giving up if it happens to have no available surface right now — a
  // pattern that's eligible but fully excluded by recency shouldn't silently
  // cost the session its only genuinely available transfer opportunity.
  const eligiblePatterns = mastery.filter(transferEligible);
  const transferOrder = opts.focusPattern
    ? [...eligiblePatterns.filter((m) => m.pattern === opts.focusPattern), ...eligiblePatterns.filter((m) => m.pattern !== opts.focusPattern)]
    : eligiblePatterns;
  if (remaining() >= 15) {
    const excludeIds = new Set(recentlyAttemptedIds);
    for (const readyForTransfer of transferOrder) {
      const candidate = pickTransferCandidate(problems, readyForTransfer.pattern, {
        excludeIds,
        avoidSurfaceTags: recentSurfaceTags(problems, recentAttempts.map((a) => a.problemId), readyForTransfer.pattern),
        referenceDifficulty: null,
      });
      if (candidate) {
        const surfaceNote = candidate.sameSurface
          ? " Couldn't find a more diverse surface in your logged problems for this pattern — using the closest available match rather than faking it."
          : " Same pattern, deliberately unfamiliar surface — the test is whether you spot it unprompted.";
        push({
          kind: "Transfer",
          minutes: 15,
          pattern: readyForTransfer.pattern,
          problemId: candidate.problem.id,
          revisionLevel: 6,
          revisionTargetId: null,
          rationale: `${readyForTransfer.pattern} is at ${readyForTransfer.state}.${surfaceNote}`,
        });
        break;
      }
    }
  }

  // 5. Fill whatever's left with new material — the current topic first, if set.
  while (remaining() >= 15) {
    const usedIds = new Set(blocks.map((b) => b.problemId).filter((id): id is number => id !== null));
    const target =
      (opts.focusPattern ? pickProblem(problems, opts.focusPattern, { preferUnsolved: true, exclude: usedIds }) : null) ??
      pickProblem(problems, null, { preferUnsolved: true, exclude: usedIds });
    if (!target) break;
    push({
      kind: "NewProblem",
      minutes: Math.min(30, remaining()),
      pattern: target.pattern,
      problemId: target.id,
      revisionLevel: null,
      revisionTargetId: null,
      rationale:
        opts.focusPattern && target.pattern === opts.focusPattern
          ? "Filling remaining time with more of today's current topic."
          : "Filling the remaining time with unsolved material.",
    });
  }

  return blocks;
}

// ---------- OA Mode (§5 of this phase): a timed, multi-problem mock exam ----------
//
// Deliberately reuses BlockDraft/SessionPlan/SessionBlock/BlockRunner rather than a
// parallel system — an OA is just a session composed differently: no revision, no
// hint ladder, no prediction step, evidence-driven problem PICKS instead of a
// priority cascade of block TYPES.

const OA_MINUTES_PER_PROBLEM = 20; // rough per-problem budget used only to size the set

export async function composeOaSession(totalMinutes: number): Promise<BlockDraft[]> {
  const [mastery, problems, recentAttempts] = await Promise.all([
    getPatternMastery(),
    prisma.problem.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.attempt.findMany({
      where: { date: { gte: new Date(Date.now() - RECENCY_EXCLUSION_DAYS * 24 * 60 * 60 * 1000) } },
      select: { problemId: true },
    }),
  ]);

  if (problems.length === 0) {
    return [
      {
        kind: "Timed",
        minutes: totalMinutes,
        pattern: null,
        problemId: null,
        revisionLevel: null,
        revisionTargetId: null,
        rationale: "No problems logged yet — nothing to build a mock test from.",
      },
    ];
  }

  const targetCount = Math.max(1, Math.round(totalMinutes / OA_MINUTES_PER_PROBLEM));
  const minutesPerProblem = Math.floor(totalMinutes / targetCount);
  const excludeIds = new Set(recentAttempts.map((a) => a.problemId));

  // Weakest pattern first (mastery is already sorted that way), then any pattern
  // with no mastery evidence yet — otherwise a pattern with zero attempts would
  // never get picked, which is the opposite of what an OA should probe.
  const patternOrder = [...new Set([...mastery.map((m) => m.pattern), ...problems.map((p) => p.pattern)])];

  const chosen: ProblemRow[] = [];

  // Pass 1: one problem per distinct pattern — this is what gives the OA real
  // pattern DISTRIBUTION instead of several variations of whatever pattern has the
  // most problems logged. Weak/unresolved patterns get an easier calibration;
  // patterns already at LOW priority (solid) get pushed harder — a real OA mixes a
  // confidence problem with a stretch problem, not five problems of one difficulty.
  for (const pattern of patternOrder) {
    if (chosen.length >= targetCount) break;
    const m = mastery.find((x) => x.pattern === pattern);
    const preferHard = m ? m.priority === "LOW" : false;
    const candidate = pickForOa(problems, pattern, excludeIds, preferHard);
    if (candidate) {
      chosen.push(candidate);
      excludeIds.add(candidate.id);
    }
  }

  // Pass 2: still short (few distinct patterns logged) — allow repeats rather than
  // padding with duplicates, but keep excluding anything already chosen.
  if (chosen.length < targetCount) {
    for (const pattern of patternOrder) {
      if (chosen.length >= targetCount) break;
      const candidate = pickForOa(problems, pattern, excludeIds, false);
      if (candidate) {
        chosen.push(candidate);
        excludeIds.add(candidate.id);
      }
    }
  }

  // Pass 3: everything is excluded (small problem set, heavy recent testing) —
  // relax recency entirely rather than silently returning an empty mock exam.
  // Still honest about it: the rationale says so explicitly.
  let usedStaleFallback = false;
  if (chosen.length === 0) {
    usedStaleFallback = true;
    for (const pattern of patternOrder) {
      if (chosen.length >= targetCount) break;
      const candidate = pickForOa(problems, pattern, new Set(chosen.map((c) => c.id)), false);
      if (candidate) chosen.push(candidate);
    }
  }

  // Honesty over padding (§4's principle, applied here): say plainly when the
  // logged problem set couldn't fill a full-length mock, rather than repeating
  // recent problems to hit the requested count.
  const shortfallNote = usedStaleFallback
    ? " Everything logged has been attempted recently — this mock reuses problems rather than being empty. Log more problems for a fresher mock."
    : chosen.length < targetCount
      ? ` Only ${chosen.length} problem${chosen.length === 1 ? "" : "s"} available without repeating recent ones — log more problems for a full-length mock.`
      : "";

  if (chosen.length === 0) {
    return [
      {
        kind: "Timed",
        minutes: totalMinutes,
        pattern: null,
        problemId: null,
        revisionLevel: null,
        revisionTargetId: null,
        rationale: "No problems logged yet — nothing to build a mock test from.",
      },
    ];
  }

  return chosen.map((p, i) => {
    const weak = mastery.find((m) => m.pattern === p.pattern)?.priority === "HIGH";
    return {
      kind: "Timed",
      minutes: minutesPerProblem,
      pattern: p.pattern,
      problemId: p.id,
      revisionLevel: null,
      revisionTargetId: null,
      rationale: `Mock OA problem ${i + 1}/${chosen.length} — ${p.pattern}${weak ? " (currently a weak pattern)" : ""}.${
        i === chosen.length - 1 ? shortfallNote : ""
      }`,
    };
  });
}

function pickForOa(problems: ProblemRow[], pattern: string, excludeIds: Set<number>, preferHard: boolean): ProblemRow | null {
  const pool = problems.filter((p) => p.pattern === pattern && !excludeIds.has(p.id));
  if (pool.length === 0) return null;
  const order = preferHard ? ["Hard", "Medium", "Easy"] : ["Easy", "Medium", "Hard"];
  for (const d of order) {
    const match = pool.find((p) => p.difficulty === d);
    if (match) return match;
  }
  return pool[0];
}

// ---------- Blind Mode (§4 of this phase): a single ad-hoc, no-help attempt ----------

export async function composeBlindSession(problemId?: number | null): Promise<BlockDraft[]> {
  const problems = await prisma.problem.findMany({ orderBy: { createdAt: "desc" } });
  if (problems.length === 0) {
    return [
      {
        kind: "Timed",
        minutes: 30,
        pattern: null,
        problemId: null,
        revisionLevel: null,
        revisionTargetId: null,
        rationale: "No problems logged yet.",
      },
    ];
  }

  let target: ProblemRow | null = null;
  if (problemId != null) {
    target = problems.find((p) => p.id === problemId) ?? null;
  } else {
    // Auto-pick: a pattern that's actually been applied before — a blind test of a
    // pattern never solved is just a hard first attempt, not a retention check.
    const mastery = await getPatternMastery();
    const ready = mastery.find((m) => m.state === "APPLIED" || m.state === "RETAINED" || m.state === "TRANSFERRED");
    target = ready ? pickProblem(problems, ready.pattern, { preferUnsolved: false }) : problems[0];
  }
  if (!target) return [];

  const minutes = TARGET_MINUTES[target.difficulty] ?? 30;
  return [
    {
      kind: "Timed",
      minutes,
      pattern: target.pattern,
      problemId: target.id,
      revisionLevel: null,
      revisionTargetId: null,
      rationale: `Blind test: ${minutes} minutes, no hints, no pattern label, no AI during the attempt.`,
    },
  ];
}

// ---------- Post-session report (§4/§5): deterministic, not AI ----------
//
// No LLM is configured in this app (by design — §14 keeps AI out of the daily
// selection path, and no key has been provided). Rather than fake an "AI report",
// this aggregates exactly what the app already captures per attempt: outcome, time
// vs. target, mistake tag, pattern. That's a real, honest report; it is not
// analysis of the submitted approach, code, or reasoning, which would need either
// a captured reflection field or an actual LLM call — neither exists yet.

export type SessionReportItem = {
  blockId: number;
  problemTitle: string | null;
  pattern: string | null;
  outcome: string | null;
  mistakeTag: string | null;
  timeTakenMin: number | null;
  targetMinutes: number | null;
};

export type SessionReport = {
  mode: string;
  totalBlocks: number;
  solvedCount: number;
  items: SessionReportItem[];
  patternCoverage: string[];
  mistakeBreakdown: Record<string, number>;
  note: string;
};

export async function getSessionReport(planId: number): Promise<SessionReport | null> {
  const plan = await prisma.sessionPlan.findUnique({
    where: { id: planId },
    include: { blocks: { orderBy: { position: "asc" } } },
  });
  if (!plan) return null;

  const problemIds = plan.blocks.map((b) => b.problemId).filter((id): id is number => id !== null);
  const problems = problemIds.length ? await prisma.problem.findMany({ where: { id: { in: problemIds } } }) : [];
  const problemById = new Map(problems.map((p) => [p.id, p]));

  // Attempts logged since the plan started, per problem — the first one after the
  // plan's own creation time is treated as belonging to it.
  const attempts = problemIds.length
    ? await prisma.attempt.findMany({
        where: { problemId: { in: problemIds }, date: { gte: plan.date } },
        orderBy: { date: "asc" },
      })
    : [];
  const attemptByProblem = new Map<number, (typeof attempts)[number]>();
  for (const a of attempts) {
    if (!attemptByProblem.has(a.problemId)) attemptByProblem.set(a.problemId, a);
  }

  const items: SessionReportItem[] = plan.blocks.map((b) => {
    const problem = b.problemId != null ? problemById.get(b.problemId) : undefined;
    const attempt = b.problemId != null ? attemptByProblem.get(b.problemId) : undefined;
    return {
      blockId: b.id,
      problemTitle: problem?.title ?? null,
      pattern: b.pattern,
      outcome: attempt?.outcome ?? null,
      mistakeTag: attempt?.mistakeTag ?? null,
      timeTakenMin: attempt?.timeTakenMin ?? null,
      targetMinutes: problem ? (TARGET_MINUTES[problem.difficulty] ?? null) : null,
    };
  });

  const solvedCount = items.filter((i) => i.outcome === "Solved").length;
  const patternCoverage = [...new Set(items.map((i) => i.pattern).filter((p): p is string => p !== null))];
  const mistakeBreakdown: Record<string, number> = {};
  for (const i of items) {
    if (i.mistakeTag) mistakeBreakdown[i.mistakeTag] = (mistakeBreakdown[i.mistakeTag] ?? 0) + 1;
  }

  return {
    mode: plan.mode,
    totalBlocks: items.length,
    solvedCount,
    items,
    patternCoverage,
    mistakeBreakdown,
    note: "Rule-based summary of what was logged this session — not an AI analysis of your approach or code (no LLM is configured in this app).",
  };
}

export type ProblemRow = { id: number; title: string; pattern: string; difficulty: string; status: string; createdAt: Date };

export function pickProblem(
  problems: ProblemRow[],
  pattern: string | null,
  opts: { preferUnsolved?: boolean; exclude?: Set<number> } = {},
): ProblemRow | null {
  const exclude = opts.exclude ?? new Set<number>();
  const pool = problems.filter((p) => !exclude.has(p.id) && (pattern === null || p.pattern === pattern));
  if (pool.length === 0) return null;
  if (opts.preferUnsolved) {
    // Attempted-but-unsolved outranks never-touched: you already paid the
    // cost of loading the problem into your head.
    const attempted = pool.find((p) => p.status === "Attempted");
    if (attempted) return attempted;
    const unsolved = pool.find((p) => p.status === "Unsolved");
    if (unsolved) return unsolved;
  }
  return pool[0];
}

function difficultyRank(d: string): number {
  return d === "Easy" ? 0 : d === "Hard" ? 2 : 1;
}

// Which surface tags to steer away from: the tags of whatever's been recently
// solved/attempted for this pattern. Deliberately looks at attempt recency, not
// just "the last problem created", since that's a better proxy for "what you've
// actually been staring at lately" (§3 constraint 2).
function recentSurfaceTags(problems: ProblemRow[], recentAttemptProblemIds: number[], pattern: string): Set<string> {
  const byId = new Map(problems.map((p) => [p.id, p]));
  const tags = new Set<string>();
  for (const id of recentAttemptProblemIds) {
    const p = byId.get(id);
    if (p && p.pattern === pattern) tags.add(deriveSurfaceTag(p.title));
  }
  return tags;
}

// Transfer candidate selection (§3, §12). Implements, in order:
//  1. same underlying pattern (the caller already filters to `pattern`)
//  2. prefer a surface different from what's been recently solved for it
//  3/4. recency + duplicate exclusion via `excludeIds` (caller passes recently-
//     attempted ids plus the triggering problem's own id)
//  5. difficulty compatibility — within one step of the reference difficulty,
//     relaxed only if nothing fits (better than reporting no candidate over a
//     minor difficulty mismatch)
// Constraint 6 (test recognition after a recent recognition failure) and
// constraint 7 (don't reveal the pattern before prediction) are handled by the
// caller/UI: the pattern is always attached to the block for scheduling purposes,
// but BlockRunner withholds it from display until a prediction is made.
export function pickTransferCandidate(
  problems: ProblemRow[],
  pattern: string,
  opts: { excludeIds: Set<number>; avoidSurfaceTags: Set<string>; referenceDifficulty: string | null },
): { problem: ProblemRow; sameSurface: boolean } | null {
  const pool = problems.filter((p) => p.pattern === pattern && !opts.excludeIds.has(p.id));
  if (pool.length === 0) return null;

  const withSurface = pool.map((p) => ({ p, surface: deriveSurfaceTag(p.title) }));

  const refRank = opts.referenceDifficulty ? difficultyRank(opts.referenceDifficulty) : null;
  const difficultyCompatible =
    refRank === null ? withSurface : withSurface.filter((x) => Math.abs(difficultyRank(x.p.difficulty) - refRank) <= 1);
  // Honest fallback: if difficulty compatibility leaves nothing, relax it rather
  // than reporting no transfer available at all.
  const usable = difficultyCompatible.length > 0 ? difficultyCompatible : withSurface;

  const diverse = usable.filter((x) => !opts.avoidSurfaceTags.has(x.surface));
  const chosen = (diverse.length > 0 ? diverse : usable)[0];
  return chosen ? { problem: chosen.p, sameSurface: opts.avoidSurfaceTags.has(chosen.surface) } : null;
}
