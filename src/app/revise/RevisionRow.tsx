"use client";

import { useState, useTransition } from "react";
import { logAttempt } from "@/app/actions";
import { MISTAKE_TAGS, OUTCOMES, type Outcome } from "@/lib/constants";

export function RevisionRow({
  problemId,
  title,
  url,
  pattern,
  difficulty,
}: {
  problemId: number;
  title: string;
  url: string | null;
  pattern: string;
  difficulty: string;
}) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [mistakeTag, setMistakeTag] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(finalOutcome: Outcome) {
    startTransition(async () => {
      await logAttempt(problemId, { outcome: finalOutcome, mistakeTag: finalOutcome === "Solved" ? null : mistakeTag, timeTakenMin: null });
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-sm text-black/40 line-through dark:border-white/10 dark:text-white/40">
        {title} — logged
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-center justify-between gap-2">
        <div>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
              {title}
            </a>
          ) : (
            <span className="font-medium">{title}</span>
          )}
          <div className="text-xs text-black/50 dark:text-white/50">
            {pattern} · {difficulty}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {OUTCOMES.map((o) => (
          <button
            key={o}
            disabled={pending}
            onClick={() => (o === "Solved" ? submit(o) : setOutcome(o))}
            className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${
              outcome === o ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-black/20 dark:border-white/25"
            }`}
          >
            {o}
          </button>
        ))}
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
                  mistakeTag === t.value
                    ? "border-amber-600 bg-amber-600 text-white"
                    : "border-black/15 text-black/70 dark:border-white/20 dark:text-white/70"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            disabled={pending}
            onClick={() => submit(outcome)}
            className="self-start rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Logging…" : "Log attempt"}
          </button>
        </>
      )}
    </div>
  );
}
