"use client";

import { useRef, useTransition } from "react";
import { createExam } from "@/app/actions";

export function ExamForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    const date = String(formData.get("date") || "");
    if (!name || !date) return;
    startTransition(async () => {
      await createExam({ name, date });
      formRef.current?.reset();
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-black/50 dark:text-white/50">Exam name</label>
        <input
          name="name"
          required
          autoFocus
          placeholder="Computer Networks"
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-black/50 dark:text-white/50">Date</label>
        <input
          name="date"
          type="date"
          required
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Adding…" : "Add exam"}
      </button>
    </form>
  );
}
