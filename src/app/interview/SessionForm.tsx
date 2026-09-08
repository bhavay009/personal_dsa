"use client";

import { useRef, useTransition } from "react";
import { logInterviewSession } from "@/app/actions";
import { INTERVIEW_CATEGORIES } from "@/lib/constants";

const MODES = [...INTERVIEW_CATEGORIES, "Project", "Mixed"];

export function SessionForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const totalQ = Number(formData.get("totalQ") || 0);
    const correctQ = Number(formData.get("correctQ") || 0);
    if (totalQ <= 0 || correctQ > totalQ) return;
    startTransition(async () => {
      await logInterviewSession({
        mode: String(formData.get("mode") || "Mixed"),
        projectId: null,
        totalQ,
        correctQ,
        notes: String(formData.get("notes") || "").trim() || null,
      });
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-wrap items-end gap-2">
        <select name="mode" defaultValue="DSA" className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20">
          {MODES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-black/50 dark:text-white/50">Questions asked</label>
          <input name="totalQ" type="number" min={1} required defaultValue={5} className="w-16 rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-black/50 dark:text-white/50">Answered well</label>
          <input name="correctQ" type="number" min={0} required defaultValue={3} className="w-16 rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Log session
        </button>
      </div>
      <input
        name="notes"
        placeholder="Notes (optional) — what tripped you up?"
        className="rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
    </form>
  );
}
