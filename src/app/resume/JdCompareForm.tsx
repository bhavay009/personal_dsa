"use client";

import { useState, useTransition } from "react";
import { compareResumeToJD } from "@/app/actions";

export function JdCompareForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ matched: string[]; missing: string[] } | null>(null);

  function handleSubmit(formData: FormData) {
    const jd = String(formData.get("jd") || "").trim();
    if (!jd) return;
    startTransition(async () => {
      setResult(await compareResumeToJD(jd));
    });
  }

  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <label className="text-xs text-black/50 dark:text-white/50">
        Paste a job description — compares its text against your tracked skills and DSA patterns
      </label>
      <textarea
        name="jd"
        rows={6}
        required
        className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Comparing…" : "Compare"}
      </button>
      {result && (
        <div className="flex flex-col gap-2 pt-2 text-sm">
          <div>
            <span className="font-medium text-green-700 dark:text-green-400">Matched ({result.matched.length})</span>
            <p className="text-black/60 dark:text-white/60">{result.matched.join(", ") || "none"}</p>
          </div>
          <div>
            <span className="font-medium text-amber-600">Missing ({result.missing.length})</span>
            <p className="text-black/60 dark:text-white/60">{result.missing.join(", ") || "none"}</p>
          </div>
        </div>
      )}
    </form>
  );
}
