"use client";

import { useTransition } from "react";
import { startOaSession } from "@/app/actions";
import { PrimaryButton } from "@/components/ui";

export function StartOaForm({ hasActivePlan }: { hasActivePlan: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd: FormData) => {
        const minutes = Number(fd.get("minutes") || 60);
        startTransition(async () => {
          await startOaSession(minutes);
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted">Duration</label>
        <select name="minutes" defaultValue="60" className="rounded border border-border-strong bg-surface px-2 py-2 text-sm">
          <option value="15">15 min</option>
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">60 min</option>
        </select>
      </div>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Composing…" : hasActivePlan ? "Start a new mock" : "START MOCK OA"}
      </PrimaryButton>
    </form>
  );
}
