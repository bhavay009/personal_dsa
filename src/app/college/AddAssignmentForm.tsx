"use client";

import { useRef, useTransition } from "react";
import { createAssignment } from "@/app/actions";

export function AddAssignmentForm({ subjectId }: { subjectId: number }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") || "").trim();
    const deadline = String(formData.get("deadline") || "");
    if (!title || !deadline) return;
    const estimateRaw = formData.get("estimateMin");
    startTransition(async () => {
      await createAssignment({
        subjectId,
        title,
        deadline,
        priority: String(formData.get("priority") || "Medium"),
        estimateMin: estimateRaw ? Number(estimateRaw) : null,
      });
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-wrap items-end gap-2">
      <input
        name="title"
        required
        placeholder="Assignment title"
        className="rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <input
        name="deadline"
        type="date"
        required
        className="rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20"
      />
      <select name="priority" defaultValue="Medium" className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20">
        <option>Low</option>
        <option>Medium</option>
        <option>High</option>
      </select>
      <input
        name="estimateMin"
        type="number"
        min={0}
        placeholder="min"
        className="w-16 rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
      />
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
