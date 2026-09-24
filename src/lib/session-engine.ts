import { getRevisionQueue, prisma } from "@/lib/db";
import { getHintDependency, getPatternMastery } from "@/lib/mastery";

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
  rationale: string;
};

const HINT_DEPENDENCY_THRESHOLD = 40; // % of recent problems that needed heavy help

export async function composeSession(goalMin: number): Promise<BlockDraft[]> {
  const [revisionQueue, mastery, hintDependency, problems] = await Promise.all([
    getRevisionQueue(),
    getPatternMastery(),
    getHintDependency(),
    prisma.problem.findMany({ orderBy: { createdAt: "desc" } }),
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
        rationale:
          "No problems logged yet, so there's nothing to schedule against. Add a few (or import from LeetCode) and the engine starts adapting from your next session.",
      },
    ];
  }

  const blocks: BlockDraft[] = [];
  let used = 0;
  const remaining = () => goalMin - used;
  const push = (b: BlockDraft) => {
    const minutes = Math.min(b.minutes, remaining());
    if (minutes < 5) return; // sub-5-minute blocks are noise
    blocks.push({ ...b, minutes });
    used += minutes;
  };

  // 1. Revision first. Anything past its spaced-repetition date is decaying right
  //    now; new material can wait an hour, forgetting can't.
  if (revisionQueue.length > 0) {
    const oldest = revisionQueue[0];
    const daysLate = oldest.nextRevision
      ? Math.floor((Date.now() - oldest.nextRevision.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    push({
      kind: "Revision",
      minutes: Math.min(20, revisionQueue.length * 6),
      pattern: null,
      problemId: null,
      rationale: `${revisionQueue.length} problem${revisionQueue.length === 1 ? "" : "s"} past the spaced-revision date${daysLate > 0 ? `, oldest by ${daysLate}d` : ""}.`,
    });
  }

  // 2. The weakest pattern sets the theme. Which block it earns depends on WHICH
  //    dimension is weak — a recognition failure and a speed failure need
  //    opposite training, and treating both as "do more problems" is the reason
  //    random practice plateaus.
  const weakest = mastery.find((m) => m.priority === "HIGH");
  if (weakest && remaining() >= 10) {
    const target = pickProblem(problems, weakest.pattern, { preferUnsolved: true });

    if (weakest.recognition.label === "weak") {
      push({
        kind: "Recall",
        minutes: 10,
        pattern: weakest.pattern,
        problemId: null,
        rationale: `Recognition for ${weakest.pattern} is weak (${weakest.recognition.pct}% of ${weakest.recognition.evidence} predictions correct). Name the pattern before writing anything.`,
      });
      push({
        kind: "Drill",
        minutes: 25,
        pattern: weakest.pattern,
        problemId: target?.id ?? null,
        rationale: `Targeted ${weakest.pattern} practice while recognition is the bottleneck.`,
      });
    } else if (weakest.speed.label === "weak") {
      push({
        kind: "Timed",
        minutes: 30,
        pattern: weakest.pattern,
        problemId: target?.id ?? null,
        rationale: `${weakest.pattern} solves land under target time only ${weakest.speed.pct}% of the time. Hard stop at the buzzer.`,
      });
    } else {
      push({
        kind: "Drill",
        minutes: 30,
        pattern: weakest.pattern,
        problemId: target?.id ?? null,
        rationale: `${weakest.pattern} is the weakest tracked pattern — ${weakest.reason}`,
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
      rationale: `${hintDependency.pct}% of your last ${hintDependency.sample} problems needed a heavy hint. No hints for the first 20 minutes of this one.`,
    });
  }

  // 4. Transfer: same pattern, different surface (§12). Only worth scheduling
  //    once a pattern has actually been applied — transfer before application is
  //    just a second unsolved problem.
  const readyForTransfer = mastery.find((m) => m.state === "APPLIED" || m.state === "RETAINED");
  if (readyForTransfer && remaining() >= 15) {
    const target = pickProblem(problems, readyForTransfer.pattern, { preferUnsolved: true });
    if (target) {
      push({
        kind: "Transfer",
        minutes: 15,
        pattern: readyForTransfer.pattern,
        problemId: target.id,
        rationale: `${readyForTransfer.pattern} is at ${readyForTransfer.state}. Same pattern, unfamiliar surface — the test is whether you spot it unprompted.`,
      });
    }
  }

  // 5. Fill whatever's left with new material.
  while (remaining() >= 15) {
    const usedIds = new Set(blocks.map((b) => b.problemId).filter((id): id is number => id !== null));
    const target = pickProblem(problems, null, { preferUnsolved: true, exclude: usedIds });
    if (!target) break;
    push({
      kind: "NewProblem",
      minutes: Math.min(30, remaining()),
      pattern: target.pattern,
      problemId: target.id,
      rationale: "Filling the remaining time with unsolved material.",
    });
  }

  return blocks;
}

type ProblemRow = { id: number; pattern: string; status: string; createdAt: Date };

function pickProblem(
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
