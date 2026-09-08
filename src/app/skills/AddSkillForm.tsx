"use client";

import { useRef, useTransition } from "react";
import { createSkill } from "@/app/actions";
import { SKILL_CATEGORIES } from "@/lib/constants";

export function AddSkillForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    startTransition(async () => {
      await createSkill({ name, category: String(formData.get("category") || "Other") });
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-wrap items-end gap-2">
      <input
        name="name"
        required
        autoFocus
        placeholder="TypeScript"
        className="rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <select name="category" defaultValue="Frontend" className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20">
        {SKILL_CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        Add
      </button>
    </form>
  );
}
