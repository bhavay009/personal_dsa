"use client";

import { useTransition } from "react";
import { updateApplicationStage } from "@/app/actions";
import { APPLICATION_STAGES } from "@/lib/constants";

export function StageSelect({ id, stage }: { id: number; stage: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={stage}
      disabled={pending}
      onChange={(e) => startTransition(() => updateApplicationStage(id, e.target.value))}
      className="rounded border border-black/15 bg-transparent px-2 py-1 text-xs disabled:opacity-50 dark:border-white/20"
    >
      {APPLICATION_STAGES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}
