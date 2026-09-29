"use client";

import { useTransition } from "react";
import { startBlindSession } from "@/app/actions";
import { PrimaryButton } from "@/components/ui";

type ProblemOption = { id: number; title: string };

export function StartBlindForm({ hasActivePlan, problems }: { hasActivePlan: boolean; problems: ProblemOption[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd: FormData) => {
        const raw = String(fd.get("problemId") || "");
        const problemId = raw ? Number(raw) : null;
        startTransition(async () => {
          await startBlindSession(problemId);
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted">Problem</label>
        <select
          name="problemId"
          defaultValue=""
          className="min-w-[220px] rounded border border-border-strong bg-surface px-2 py-2 text-sm"
        >
          <option value="">Let the engine pick</option>
          {problems.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Composing…" : hasActivePlan ? "Start a new blind test" : "START BLIND TEST"}
      </PrimaryButton>
    </form>
  );
}
