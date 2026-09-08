"use client";

import { useTransition } from "react";
import { deleteSkill, updateSkillStage } from "@/app/actions";

const STAGES = [
  { key: "learned", label: "L" },
  { key: "practiced", label: "P" },
  { key: "built", label: "B" },
  { key: "explained", label: "E" },
  { key: "interviewReady", label: "IR" },
] as const;

export function SkillRow({
  id,
  name,
  stages,
}: {
  id: number;
  name: string;
  stages: Record<(typeof STAGES)[number]["key"], boolean>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        {STAGES.map((s) => (
          <button
            key={s.key}
            disabled={pending}
            title={s.key}
            onClick={() => startTransition(() => updateSkillStage(id, s.key, !stages[s.key]))}
            className={`h-6 w-6 rounded text-[10px] font-semibold disabled:opacity-50 ${
              stages[s.key]
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-black/5 text-black/40 dark:bg-white/10 dark:text-white/40"
            }`}
          >
            {s.label}
          </button>
        ))}
        <form action={deleteSkill.bind(null, id)}>
          <button className="ml-2 text-xs text-black/30 hover:text-red-600 dark:text-white/30 dark:hover:text-red-400">×</button>
        </form>
      </div>
    </div>
  );
}
