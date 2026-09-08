"use client";

import { useRef, useTransition } from "react";
import { createInterviewQuestion } from "@/app/actions";
import { INTERVIEW_CATEGORIES, QUESTION_DIFFICULTIES } from "@/lib/constants";

export function QuestionForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const question = String(formData.get("question") || "").trim();
    if (!question) return;
    startTransition(async () => {
      await createInterviewQuestion({
        category: String(formData.get("category") || "DSA"),
        difficulty: String(formData.get("difficulty") || "Medium"),
        question,
      });
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-wrap items-end gap-2">
      <select name="category" defaultValue="DSA" className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20">
        {INTERVIEW_CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <select name="difficulty" defaultValue="Medium" className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20">
        {QUESTION_DIFFICULTIES.map((d) => (
          <option key={d}>{d}</option>
        ))}
      </select>
      <input
        name="question"
        placeholder="Question text"
        className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
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
