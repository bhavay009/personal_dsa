"use client";

import { useTransition } from "react";
import { startTodaySession } from "@/app/actions";

export function StartSessionForm({ hasActivePlan }: { hasActivePlan: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd: FormData) => {
        const goalMin = Number(fd.get("goalMin") || 60);
        startTransition(async () => {
          await startTodaySession(goalMin);
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-black/50 dark:text-white/50">Time available</label>
        <select
          name="goalMin"
          defaultValue="60"
          className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm dark:border-white/20"
        >
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">60 min</option>
          <option value="90">90 min</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Composing…" : hasActivePlan ? "Recompose session" : "START TODAY'S DSA"}
      </button>
    </form>
  );
}
