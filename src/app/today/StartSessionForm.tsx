"use client";

import { useTransition } from "react";
import { startTodaySession } from "@/app/actions";
import { PrimaryButton, SecondaryButton } from "@/components/ui";

export function StartSessionForm({ hasActivePlan, compact = false }: { hasActivePlan: boolean; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const Button = compact ? SecondaryButton : PrimaryButton;

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
        <label className="text-xs text-muted">Time available</label>
        <select
          name="goalMin"
          defaultValue="60"
          className="rounded border border-border-strong bg-surface px-2 py-2 text-sm"
        >
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">60 min</option>
          <option value="90">90 min</option>
        </select>
      </div>
      <Button type="submit" disabled={pending} className={compact ? "" : "px-6 py-3 text-base"}>
        {pending ? "Composing…" : hasActivePlan ? "Recompose session" : "START TODAY'S DSA"}
      </Button>
    </form>
  );
}
