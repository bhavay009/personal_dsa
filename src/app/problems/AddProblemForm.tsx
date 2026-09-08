"use client";

import { useRef, useState, useTransition } from "react";
import { createProblem } from "@/app/actions";
import { DIFFICULTIES, MISTAKE_TAGS, OUTCOMES, PATTERNS, type Outcome } from "@/lib/constants";

export function AddProblemForm() {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [mistakeTag, setMistakeTag] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") || "").trim();
    if (!title) return;
    const timeRaw = formData.get("timeTakenMin");
    startTransition(async () => {
      await createProblem({
        title,
        url: (String(formData.get("url") || "").trim() || null),
        pattern: String(formData.get("pattern")),
        difficulty: String(formData.get("difficulty")),
        attempt: {
          outcome,
          mistakeTag: outcome === "Solved" ? null : mistakeTag,
          timeTakenMin: timeRaw ? Number(timeRaw) : null,
        },
      });
      formRef.current?.reset();
      setOutcome(null);
      setMistakeTag(null);
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="title"
          placeholder="Problem title"
          required
          autoFocus
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <input
          name="url"
          placeholder="Link (optional)"
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <select
          name="pattern"
          defaultValue={PATTERNS[0]}
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        >
          {PATTERNS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          name="difficulty"
          defaultValue="Medium"
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-black/50 dark:text-white/50">Outcome:</span>
        <button
          type="button"
          onClick={() => setOutcome(null)}
          className={`rounded-full border px-3 py-1 text-xs ${
            outcome === null ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-black/20 dark:border-white/25"
          }`}
        >
          Just bookmark
        </button>
        {OUTCOMES.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOutcome(o)}
            className={`rounded-full border px-3 py-1 text-xs ${
              outcome === o ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-black/20 dark:border-white/25"
            }`}
          >
            {o}
          </button>
        ))}
        {outcome && (
          <input
            name="timeTakenMin"
            type="number"
            min={0}
            placeholder="min"
            className="w-16 rounded border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
          />
        )}
      </div>

      {outcome && outcome !== "Solved" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-black/50 dark:text-white/50">What went wrong:</span>
          {MISTAKE_TAGS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setMistakeTag(mistakeTag === t.value ? null : t.value)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                mistakeTag === t.value
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-black/15 text-black/70 dark:border-white/20 dark:text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Adding…" : "Add problem"}
      </button>
    </form>
  );
}
