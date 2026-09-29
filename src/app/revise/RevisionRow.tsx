"use client";

import { useState, useTransition } from "react";
import { logAttempt } from "@/app/actions";
import { MISTAKE_TAGS, OUTCOMES, type Outcome } from "@/lib/constants";
import { LEVEL_EXPLANATION, REVISION_LEVELS, type RevisionLevelId } from "@/lib/revision";
import { Panel, PrimaryButton, SecondaryButton, SectionLabel, StatusBadge } from "@/components/ui";

export function RevisionRow({
  problemId,
  title,
  url,
  pattern,
  difficulty,
  revisionLevel,
  highlight = false,
}: {
  problemId: number;
  title: string;
  url: string | null;
  pattern: string;
  difficulty: string;
  revisionLevel: RevisionLevelId;
  highlight?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [started, setStarted] = useState(highlight);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [mistakeTag, setMistakeTag] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const level = REVISION_LEVELS[revisionLevel];

  function submit(finalOutcome: Outcome) {
    startTransition(async () => {
      await logAttempt(problemId, { outcome: finalOutcome, mistakeTag: finalOutcome === "Solved" ? null : mistakeTag, timeTakenMin: null });
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm text-muted line-through">
        {title} — logged
      </div>
    );
  }

  return (
    <Panel className={highlight ? "border-border-strong" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {highlight && <SectionLabel className="mb-1">Today&apos;s priority</SectionLabel>}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{pattern}</span>
            <StatusBadge tone="neutral">
              Level {revisionLevel} / 7 · {level.name}
            </StatusBadge>
          </div>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="mt-1 block text-sm hover:underline">
              {title} ↗
            </a>
          ) : (
            <p className="mt-1 text-sm">{title}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted">{difficulty}</span>
      </div>

      <p className="mt-2 text-sm text-foreground/80">{LEVEL_EXPLANATION[revisionLevel]}</p>

      {!started ? (
        <PrimaryButton onClick={() => setStarted(true)} className="mt-3">
          Start revision
        </PrimaryButton>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) =>
              o === "Solved" ? (
                <PrimaryButton key={o} disabled={pending} onClick={() => submit(o)} className="px-3 py-1 text-xs">
                  Solved
                </PrimaryButton>
              ) : (
                <SecondaryButton
                  key={o}
                  disabled={pending}
                  onClick={() => setOutcome(o)}
                  className={`px-3 py-1 text-xs ${outcome === o ? "bg-surface-muted" : ""}`}
                >
                  {o}
                </SecondaryButton>
              ),
            )}
          </div>

          {outcome && outcome !== "Solved" && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {MISTAKE_TAGS.map((t) => (
                  <button
                    key={t.value}
                    disabled={pending}
                    onClick={() => setMistakeTag(mistakeTag === t.value ? null : t.value)}
                    className={`rounded-full border px-2.5 py-1 text-xs disabled:opacity-50 ${
                      mistakeTag === t.value ? "border-warning bg-warning-bg text-warning" : "border-border-strong text-foreground/70"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <PrimaryButton disabled={pending} onClick={() => submit(outcome)} className="self-start">
                {pending ? "Logging…" : "Log attempt"}
              </PrimaryButton>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
