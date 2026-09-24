"use client";

import { useEffect, useState, useTransition } from "react";
import { logAttempt, recordHint, recordPatternPrediction, setBlockStatus } from "@/app/actions";
import { MISTAKE_TAGS, OUTCOMES, PATTERNS, type Outcome } from "@/lib/constants";
import { HINT_LADDER, MAX_HINT_LEVEL, hintAt } from "@/lib/hints";

type Problem = { id: number; title: string; url: string | null; difficulty: string };

export function BlockRunner({
  blockId,
  kind,
  minutes,
  pattern,
  rationale,
  status,
  problem,
  alreadyPredicted,
}: {
  blockId: number;
  kind: string;
  minutes: number;
  pattern: string | null;
  rationale: string;
  status: string;
  problem: Problem | null;
  alreadyPredicted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [prediction, setPrediction] = useState<{ correct: boolean; actual: string } | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const overrun = startedAt !== null && elapsed > minutes * 60;
  const currentHint = hintAt(hintLevel);

  function takeHint() {
    const next = Math.min(hintLevel + 1, MAX_HINT_LEVEL);
    setHintLevel(next);
    if (problem) {
      const secondsBefore = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      startTransition(() => recordHint(problem.id, next, secondsBefore));
    }
  }

  const done = status === "Done";
  const skipped = status === "Skipped";

  return (
    <div
      className={`rounded-lg border p-4 ${
        done ? "border-black/10 opacity-60 dark:border-white/10" : "border-black/15 dark:border-white/20"
      }`}
    >
      <button onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-black/[0.07] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide dark:bg-white/15">
              {kind}
            </span>
            {pattern && <span className="text-sm font-medium">{pattern}</span>}
            {done && <span className="text-xs text-green-700 dark:text-green-400">done</span>}
            {skipped && <span className="text-xs text-black/40 dark:text-white/40">skipped</span>}
          </div>
          {problem && <div className="mt-1 truncate text-sm">{problem.title}</div>}
          <div className="mt-1 text-xs text-black/50 dark:text-white/50">{rationale}</div>
        </div>
        <span className="shrink-0 text-sm font-semibold">{minutes}m</span>
      </button>

      {open && !done && !skipped && (
        <div className="mt-4 flex flex-col gap-4 border-t border-black/10 pt-4 dark:border-white/10">
          {problem && (
            <div className="flex items-center justify-between gap-2">
              {problem.url ? (
                <a href={problem.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                  {problem.title} ↗
                </a>
              ) : (
                <span className="text-sm font-medium">{problem.title}</span>
              )}
              <span className="text-xs text-black/40 dark:text-white/40">{problem.difficulty}</span>
            </div>
          )}

          {/* Step 1 — predict the pattern before solving (§11). */}
          {problem && !alreadyPredicted && !prediction && (
            <form
              action={(fd: FormData) => {
                const predicted = String(fd.get("predicted") || "");
                startTransition(async () => setPrediction(await recordPatternPrediction(problem.id, predicted)));
              }}
              className="flex flex-col gap-2 rounded border border-black/10 p-3 dark:border-white/15"
            >
              <label className="text-xs font-medium">Before you start: which pattern is this testing?</label>
              <div className="flex gap-2">
                <select
                  name="predicted"
                  defaultValue={PATTERNS[0]}
                  className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
                >
                  {PATTERNS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-black px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  Lock it in
                </button>
              </div>
            </form>
          )}

          {prediction && (
            <p className={`text-sm ${prediction.correct ? "text-green-700 dark:text-green-400" : "text-amber-600"}`}>
              {prediction.correct
                ? `Correct — ${prediction.actual}.`
                : `Not quite — it's ${prediction.actual}. Worth asking what made you read it the other way.`}
            </p>
          )}

          {/* Step 2 — timer. */}
          <div className="flex items-center gap-3">
            {startedAt === null ? (
              <button
                onClick={() => setStartedAt(Date.now())}
                className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
              >
                Start timer
              </button>
            ) : (
              <span className={`font-mono text-sm ${overrun ? "text-red-600" : ""}`}>
                {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                {overrun && ` · over ${minutes}m`}
              </span>
            )}
          </div>

          {/* Step 3 — the hint ladder (§8). */}
          {problem && (
            <div className="flex flex-col gap-2 rounded border border-black/10 p-3 dark:border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {hintLevel === 0
                    ? "No hints taken"
                    : `Hint level ${hintLevel} / ${MAX_HINT_LEVEL} — ${currentHint?.title}`}
                </span>
                <button
                  onClick={takeHint}
                  disabled={pending || hintLevel >= MAX_HINT_LEVEL}
                  className="rounded border border-black/20 px-2 py-1 text-xs disabled:opacity-40 dark:border-white/25"
                >
                  {hintLevel === 0 ? "I'm stuck" : "Still stuck"}
                </button>
              </div>
              {currentHint ? (
                <ul className="list-disc space-y-1 pl-4 text-sm text-black/70 dark:text-white/70">
                  {currentHint.prompts.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-black/40 dark:text-white/40">
                  Sit with it first. The ladder starts with questions, not answers — {HINT_LADDER.length} levels before a
                  solution.
                </p>
              )}
            </div>
          )}

          {/* Step 4 — log the attempt, feeding the learner model. */}
          {problem && !logged && (
            <form
              action={(fd: FormData) => {
                const outcome = String(fd.get("outcome") || "") as Outcome;
                if (!outcome) return;
                const tag = String(fd.get("mistakeTag") || "");
                const mins = startedAt ? Math.max(1, Math.round(elapsed / 60)) : null;
                startTransition(async () => {
                  await logAttempt(problem.id, {
                    outcome,
                    mistakeTag: tag || null,
                    timeTakenMin: mins,
                  });
                  setLogged(true);
                  await setBlockStatus(blockId, "Done");
                });
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <select
                name="outcome"
                defaultValue="Solved"
                className="rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
              >
                {OUTCOMES.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <select
                name="mistakeTag"
                defaultValue=""
                className="rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
              >
                <option value="">No mistake to tag</option>
                {MISTAKE_TAGS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                Log &amp; finish block
              </button>
            </form>
          )}

          <div className="flex gap-3 text-xs">
            {!problem && (
              <button
                onClick={() => startTransition(() => setBlockStatus(blockId, "Done"))}
                disabled={pending}
                className="font-medium disabled:opacity-50"
              >
                Mark done
              </button>
            )}
            <button
              onClick={() => startTransition(() => setBlockStatus(blockId, "Skipped"))}
              disabled={pending}
              className="text-black/40 disabled:opacity-50 dark:text-white/40"
            >
              Skip this block
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
