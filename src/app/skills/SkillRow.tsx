"use client";

import { useState, useTransition } from "react";
import { deleteSkill, updateSkill, updateSkillStage } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { SKILL_CATEGORIES } from "@/lib/constants";

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
  category,
  stages,
}: {
  id: number;
  name: string;
  category: string;
  stages: Record<(typeof STAGES)[number]["key"], boolean>;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={(formData: FormData) => {
          const nextName = String(formData.get("name") || "").trim();
          if (!nextName) return;
          startTransition(async () => {
            await updateSkill(id, { name: nextName, category: String(formData.get("category") || category) });
            setEditing(false);
          });
        }}
        className="flex items-center gap-2 py-2"
      >
        <input
          name="name"
          defaultValue={name}
          required
          autoFocus
          className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <select
          name="category"
          defaultValue={category}
          className="rounded border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
        >
          {SKILL_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="text-xs font-medium disabled:opacity-50">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-black/40 dark:text-white/40">
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <button onClick={() => setEditing(true)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline">
        {name}
      </button>
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
        <ConfirmDeleteButton
          action={deleteSkill.bind(null, id)}
          confirmMessage={`Delete "${name}"? This can't be undone.`}
          className="ml-2 text-xs text-black/30 hover:text-red-600 dark:text-white/30 dark:hover:text-red-400"
        >
          ×
        </ConfirmDeleteButton>
      </div>
    </div>
  );
}
