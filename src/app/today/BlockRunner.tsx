"use client";

import { useEffect, useState, useTransition } from "react";
import { logAttempt, recordHint, recordPatternPrediction, setBlockStatus } from "@/app/actions";
import { KIND_LABEL } from "@/lib/block-labels";
import { MISTAKE_TAGS, OUTCOMES, PATTERNS, type Outcome } from "@/lib/constants";
import { HINT_LADDER, MAX_HINT_LEVEL, hintAt } from "@/lib/hints";
import { REVISION_LEVELS, type RevisionLevelId } from "@/lib/revision";
import { PrimaryButton, Rationale, SecondaryButton, SectionLabel, StatusBadge } from "@/components/ui";
import { PatternIntelligencePanel, type PatternKnowledgeClient } from "@/components/PatternIntelligencePanel";
import { MyNotesPanel, type NoteRow } from "@/components/MyNotesPanel";

type Problem = { id: number; title: string; url: string | null; difficulty: string };
type ReviewData = { outcome: Outcome; mistakeTag: string | null; timeTakenMin: number | null };
export type WhatToRememberClient = {
  pattern: string;
  trigger: string | null;
  mentalModel: string;
  invariant: string;
  commonTrap: string | null;
  relatedPattern: string | null;
  nextPractice: string;
  mistakeGuidance: string | null;
};

const RECALL_PROMPT: Record<number, string> = {
  1: "What pattern does this problem belong to?",
  2: "What is the key idea or invariant behind this pattern?",
};

const CONFIDENCE_OPTIONS = [
  { label: "Low", value: 2 },
  { label: "Medium", value: 3 },
  { label: "High", value: 5 },
];

export function BlockRunner({
  blockId,
  kind,
  minutes,
  pattern,
  revisionLevel,
  revisionTargetId,
  rationale,
  status,
  problem,
  alreadyPredicted,
  mode = "Daily",
  isCurrent = false,
  locked = false,
  patternKnowledge = null,
  confusion = null,
  notes = [],
  whatToRemember = null,
  suggestedTakeaways = [],
}: {
  blockId: number;
  kind: string;
  minutes: number;
  pattern: string | null;
  revisionLevel: number | null;
  revisionTargetId: number | null;
  rationale: string;
  status: string;
  problem: Problem | null;
  alreadyPredicted: boolean;
  mode?: "Daily" | "OA" | "Blind";
  isCurrent?: boolean;
  locked?: boolean;
  // Pattern Intelligence + Personal Notes (optional — /oa and /blind don't pass
  // these yet, so they default to off rather than requiring every caller to change).
  patternKnowledge?: PatternKnowledgeClient | null;
  confusion?: { other: string; count: number } | null;
  notes?: NoteRow[];
  whatToRemember?: WhatToRememberClient | null;
  suggestedTakeaways?: string[];
}) {
  const [open, setOpen] = useState(isCurrent);
  const [pending, startTransition] = useTransition();

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [prediction, setPrediction] = useState<{ correct: boolean; actual: string } | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false); // pattern/concept recall: think first, then reveal
  const [showClue, setShowClue] = useState(false); // §2: "HELP ME RECOGNIZE THE PATTERN" — clues only, never the name

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const overrun = startedAt !== null && elapsed > minutes * 60;
  const approaching = startedAt !== null && !overrun && elapsed > minutes * 60 * 0.8;
  const currentHint = hintAt(hintLevel);

  const isPureRecall = revisionLevel === 1 || revisionLevel === 2;
  const isTimedBlind = revisionLevel === 7 || mode !== "Daily";
  const isTransferKind = kind === "Transfer";

  const predictionPending =
    Boolean(problem) && !alreadyPredicted && !prediction && !isPureRecall && mode !== "OA";
  const hidePatternLabel = revisionLevel === 1 || isTimedBlind || predictionPending;

  const levelMeta = revisionLevel ? REVISION_LEVELS[revisionLevel as RevisionLevelId] : null;
  const badgeLabel = levelMeta ? levelMeta.name : (KIND_LABEL[kind] ?? kind);

  function takeHint() {
    const next = Math.min(hintLevel + 1, MAX_HINT_LEVEL);
    setHintLevel(next);
    if (problem) {
      const secondsBefore = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      startTransition(() => recordHint(problem.id, next, secondsBefore));
    }
  }

  function finishRecall(outcome: Outcome, mistakeTag: string | null) {
    if (!problem) return;
    startTransition(async () => {
      await logAttempt(problem.id, { outcome, mistakeTag, timeTakenMin: null });
      setReview({ outcome, mistakeTag, timeTakenMin: null });
    });
  }

  const done = status === "Done";
  const skipped = status === "Skipped";

  // The circular marker in the vertical timeline: done / current / pending.
  const marker = done ? "done" : skipped ? "skipped" : isCurrent ? "current" : "pending";

  if (locked) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 opacity-60">
        <Marker state="pending" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{badgeLabel}</p>
          <p className="mt-0.5 text-xs text-muted">Locked — finish the previous problem first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${done || skipped ? "border-border" : "border-border-strong"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-3 text-left"
        disabled={done || skipped}
      >
        <div className="flex min-w-0 items-start gap-3">
          <Marker state={marker} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{badgeLabel}</span>
              {pattern && !hidePatternLabel && <span className="text-xs text-muted">{pattern}</span>}
              {done && review && <StatusBadge tone={review.outcome === "Solved" ? "success" : "danger"}>{review.outcome}</StatusBadge>}
              {skipped && <StatusBadge>Skipped</StatusBadge>}
            </div>
            {problem && !isPureRecall && (done || skipped) && <div className="mt-1 truncate text-sm text-muted">{problem.title}</div>}
            {/* Collapsed-state preview only — once open, the Rationale panel below
                already shows this same text, so showing it here too would be a
                duplicate rather than useful context. */}
            {!open && !done && !skipped && <div className="mt-1 text-xs text-muted">{rationale}</div>}
          </div>
        </div>
        <span className="shrink-0 text-sm font-medium text-muted">{minutes}m</span>
      </button>

      {open && !done && !skipped && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
          {!isPureRecall && rationale && <Rationale>{rationale}</Rationale>}

          {/* Pure recall (Level 1/2): think first, then reveal, then self-assess. No
              code surface, no hints — that's the point of testing recall alone. */}
          {problem && isPureRecall && !review && (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <SectionLabel>{levelMeta?.name ?? "Recall"}</SectionLabel>
              <p className="text-sm font-medium">{RECALL_PROMPT[revisionLevel!]}</p>
              <p className="text-sm text-muted">{problem.title}</p>
              {!revealed ? (
                <SecondaryButton onClick={() => setRevealed(true)} className="self-start text-xs">
                  Answer in your head, then reveal
                </SecondaryButton>
              ) : (
                <>
                  <p className="text-sm font-medium">{pattern}</p>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton onClick={() => finishRecall("Solved", null)} disabled={pending} className="text-xs">
                      I remembered it
                    </PrimaryButton>
                    <SecondaryButton
                      onClick={() => finishRecall("Failed", revisionLevel === 1 ? "pattern-recognition" : "forgot-concept")}
                      disabled={pending}
                      className="text-xs"
                    >
                      I didn&apos;t remember it
                    </SecondaryButton>
                  </div>
                </>
              )}
            </div>
          )}

          {isPureRecall && review && (
            <ReviewPanel
              review={review}
              targetMinutes={minutes}
              predictionCorrect={null}
              onContinue={() => startTransition(() => setBlockStatus(blockId, "Done"))}
              pending={pending}
            />
          )}

          {/* Predict → Solve stays the primary flow; the LeetCode link is a small
              secondary action next to the title, only shown when a verified URL
              already exists on the problem — never guessed from the title. */}
          {!isPureRecall && problem && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{problem.title}</span>
                <span className="text-xs text-muted">{problem.difficulty}</span>
              </div>
              {problem.url && (
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="self-start text-xs font-medium text-accent underline-offset-2 hover:underline"
                >
                  {problem.url.includes("leetcode.com") ? "Open on LeetCode ↗" : "Open problem ↗"}
                </a>
              )}
            </div>
          )}

          {/* Step 1 — predict the pattern before solving (§11). Everything past this
              point (timer, hints, outcome) stays hidden until the prediction is
              locked in — recognition has to happen before implementation starts. */}
          {predictionPending && (
            <form
              action={(fd: FormData) => {
                const predicted = String(fd.get("predicted") || "");
                const conf = fd.get("confidence") ? Number(fd.get("confidence")) : null;
                const reasoning = isTransferKind ? String(fd.get("reasoning") || "") || null : null;
                startTransition(async () =>
                  setPrediction(await recordPatternPrediction(problem!.id, predicted, { confidence: conf, reasoning })),
                );
              }}
              className="flex flex-col gap-3 rounded-md border border-border-strong p-3"
            >
              <SectionLabel>Step 1 · Recognize the pattern</SectionLabel>
              <p className="text-sm text-muted">Don&apos;t code yet. What technique do you think this problem is testing?</p>
              <select
                name="predicted"
                defaultValue={PATTERNS[0]}
                className="rounded border border-border-strong bg-surface px-2 py-1.5 text-sm"
              >
                {PATTERNS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              {isTransferKind && (
                <>
                  <label className="text-xs font-medium text-muted">Confidence</label>
                  <select name="confidence" defaultValue="" className="rounded border border-border-strong bg-surface px-2 py-1.5 text-sm">
                    <option value="">Skip</option>
                    {CONFIDENCE_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs font-medium text-muted">What clue made you choose that?</label>
                  <textarea
                    name="reasoning"
                    rows={2}
                    className="rounded border border-border-strong bg-surface px-2 py-1.5 text-sm"
                    placeholder="Optional, but worth writing down"
                  />
                </>
              )}
              <PrimaryButton type="submit" disabled={pending} className="self-start">
                Lock in prediction
              </PrimaryButton>
            </form>
          )}

          {/* §2: help without naming the pattern — signals + when-to-use only, so
              recognition still has to happen before the label is confirmed. */}
          {predictionPending && patternKnowledge && (
            <div className="flex flex-col gap-2">
              {!showClue ? (
                <SecondaryButton onClick={() => setShowClue(true)} className="self-start text-xs">
                  Help me recognize the pattern
                </SecondaryButton>
              ) : (
                <div className="rounded-md border border-border bg-surface-muted p-2.5">
                  <SectionLabel>Clues (not the answer)</SectionLabel>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-foreground/80">
                    {patternKnowledge.signals.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {prediction && !review && (
            <p className="text-sm text-muted">
              Prediction locked — <span className="font-medium text-foreground">{pattern ?? "the pattern"}</span>. Now solve without changing it.
            </p>
          )}

          {/* Step 2 — timer, then hints + reflection open up once it's running.
              Withheld until any pending prediction is locked in — recognition has
              to happen before implementation starts. */}
          {!isPureRecall && !review && !predictionPending && (
            <div className="flex items-center gap-3">
              {startedAt === null ? (
                <PrimaryButton onClick={() => setStartedAt(Date.now())}>Start timer</PrimaryButton>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-mono text-lg tabular-nums ${
                      overrun ? "text-danger" : approaching ? "text-warning" : "text-foreground"
                    }`}
                  >
                    {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-muted">target {minutes}m{overrun && " · over target"}</span>
                </div>
              )}
            </div>
          )}

          {problem && !isPureRecall && !isTimedBlind && startedAt !== null && !review && (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <SectionLabel>{hintLevel === 0 ? "Need help?" : `Hint ${hintLevel} / ${MAX_HINT_LEVEL} · ${currentHint?.title}`}</SectionLabel>
                <SecondaryButton onClick={takeHint} disabled={pending || hintLevel >= MAX_HINT_LEVEL} className="px-2 py-1 text-xs">
                  {hintLevel === 0 ? "I'm stuck" : "Still stuck"}
                </SecondaryButton>
              </div>
              {currentHint ? (
                <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/80">
                  {currentHint.prompts.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">This is a coaching ladder, not an answer key — {HINT_LADDER.length} question-based levels before a solution.</p>
              )}
            </div>
          )}
          {problem && isTimedBlind && startedAt !== null && !review && (
            <p className="text-xs text-muted">No hints on a timed test — that&apos;s the point.</p>
          )}

          {/* Step 3 — reflection, replacing a bare outcome dropdown. */}
          {problem && !isPureRecall && !review && (!isTimedBlind || startedAt !== null) && startedAt !== null && (
            <form
              action={(fd: FormData) => {
                const outcome = String(fd.get("outcome") || "") as Outcome;
                if (!outcome) return;
                const tag = String(fd.get("mistakeTag") || "");
                const mins = startedAt ? Math.max(1, Math.round(elapsed / 60)) : null;
                startTransition(async () => {
                  await logAttempt(problem.id, { outcome, mistakeTag: tag || null, timeTakenMin: mins, confidence }, revisionTargetId);
                  setReview({ outcome, mistakeTag: tag || null, timeTakenMin: mins });
                });
              }}
              className="flex flex-col gap-3 rounded-md border border-border-strong p-3"
            >
              <SectionLabel>How did that go?</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {OUTCOMES.map((o, i) => (
                  <label key={o} className="flex items-center gap-1.5 text-sm">
                    <input type="radio" name="outcome" value={o} defaultChecked={i === 0} className="accent-[var(--accent)]" />
                    {o}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted">Confidence</span>
                {CONFIDENCE_OPTIONS.map((c) => (
                  <label key={c.value} className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="confidenceChoice"
                      checked={confidence === c.value}
                      onChange={() => setConfidence(c.value)}
                      className="accent-[var(--accent)]"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
              <select name="mistakeTag" defaultValue="" className="rounded border border-border-strong bg-surface px-2 py-1.5 text-sm">
                <option value="">No mistake to tag (optional)</option>
                {MISTAKE_TAGS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <PrimaryButton type="submit" disabled={pending} className="self-start">
                Complete review
              </PrimaryButton>
            </form>
          )}

          {!isPureRecall && review && (
            <ReviewPanel
              review={review}
              targetMinutes={minutes}
              predictionCorrect={prediction?.correct ?? null}
              onContinue={() => startTransition(() => setBlockStatus(blockId, "Done"))}
              pending={pending}
              whatToRemember={whatToRemember}
            />
          )}

          {/* §3, §33-§34: Pattern Intelligence — only once the pattern is no
              longer hidden from the learner (same gate as the label itself),
              auto-opened once the problem is reviewed. */}
          {pattern && !hidePatternLabel && patternKnowledge && (
            <PatternIntelligencePanel knowledge={patternKnowledge} confusion={confusion} defaultOpen={Boolean(review)} />
          )}

          {/* §14-§20: personal notes, scoped to this problem. */}
          {problem && <MyNotesPanel scope={{ problemId: problem.id }} notes={notes} suggestions={review ? suggestedTakeaways : undefined} defaultOpen={Boolean(review)} />}

          {!review && (
            <div className="flex gap-3 text-xs">
              {!problem && (
                <SecondaryButton onClick={() => startTransition(() => setBlockStatus(blockId, "Done"))} disabled={pending} className="px-2 py-1">
                  Mark done
                </SecondaryButton>
              )}
              <button
                onClick={() => startTransition(() => setBlockStatus(blockId, "Skipped"))}
                disabled={pending}
                className="text-muted underline-offset-2 hover:underline disabled:opacity-50"
              >
                Skip this block
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Marker({ state }: { state: "done" | "current" | "pending" | "skipped" }) {
  if (state === "done") return <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-[11px] font-bold text-background">✓</span>;
  if (state === "skipped") return <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-strong text-[11px] text-muted">–</span>;
  if (state === "current") return <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center"><span className="h-2.5 w-2.5 rounded-full bg-accent" /></span>;
  return <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center"><span className="h-2.5 w-2.5 rounded-full border-2 border-border-strong" /></span>;
}

// Post-problem review (§14) — closure before the block collapses into the
// timeline, instead of jumping straight to "done" with no summary.
function ReviewPanel({
  review,
  targetMinutes,
  predictionCorrect,
  onContinue,
  pending,
  whatToRemember,
}: {
  review: ReviewData;
  targetMinutes: number;
  predictionCorrect: boolean | null;
  onContinue: () => void;
  pending: boolean;
  whatToRemember?: WhatToRememberClient | null;
}) {
  const overTime = review.timeTakenMin != null && review.timeTakenMin > targetMinutes;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-strong bg-surface-muted p-3">
      <SectionLabel>Review</SectionLabel>
      <div className="flex items-center gap-2">
        <StatusBadge tone={review.outcome === "Solved" ? "success" : review.outcome === "Partial" ? "warning" : "danger"}>
          {review.outcome}
        </StatusBadge>
        {predictionCorrect !== null && (
          <StatusBadge tone={predictionCorrect ? "success" : "warning"}>
            {predictionCorrect ? "Pattern recognized" : "Pattern missed"}
          </StatusBadge>
        )}
        {review.timeTakenMin != null && (
          <span className={`text-xs ${overTime ? "text-warning" : "text-muted"}`}>
            {review.timeTakenMin}m {overTime ? `· over the ${targetMinutes}m target` : `/ ${targetMinutes}m target`}
          </span>
        )}
      </div>
      {review.mistakeTag && (
        <p className="text-sm text-foreground/80">
          Mistake tagged: <span className="font-medium">{MISTAKE_TAGS.find((t) => t.value === review.mistakeTag)?.label ?? review.mistakeTag}</span>
        </p>
      )}

      {/* §23: the compact post-problem learning card — never the full solution. */}
      {whatToRemember && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-3">
          <SectionLabel>What to remember</SectionLabel>
          <Row label="Pattern" value={whatToRemember.pattern} />
          {whatToRemember.trigger && <Row label="Trigger" value={whatToRemember.trigger} />}
          <Row label="Mental model" value={whatToRemember.mentalModel} />
          <Row label="Invariant" value={whatToRemember.invariant} />
          {whatToRemember.commonTrap && <Row label="Common trap" value={whatToRemember.commonTrap} />}
          {whatToRemember.relatedPattern && <Row label="Related pattern" value={whatToRemember.relatedPattern} />}
          <Row label="Next practice" value={whatToRemember.nextPractice} />
          {whatToRemember.mistakeGuidance && <p className="mt-1 text-xs text-foreground/70">{whatToRemember.mistakeGuidance}</p>}
        </div>
      )}

      <PrimaryButton onClick={onContinue} disabled={pending} className="self-start">
        Continue
      </PrimaryButton>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-foreground/80">
      <span className="font-medium text-foreground/60">{label}: </span>
      {value}
    </p>
  );
}
