"use client";

import { useRef, useState, useTransition } from "react";
import { addProjectQuestion, deleteInterviewQuestion } from "@/app/actions";

const DEFAULT_PROMPTS: Record<string, string[]> = {
  Easy: ["What does this project do, in one sentence?", "Who is it for, and what problem does it solve?"],
  Medium: ["Why did you choose this database / framework over the alternatives?", "Walk me through the request flow for the core feature."],
  Hard: ["How would you prevent a race condition in the write path?", "What's the biggest architectural mistake you'd fix if you rebuilt it?"],
  Advanced: ["How would you scale this to 1M users?", "How would you add multi-region support without downtime?"],
};

export function ProjectInterviewer({
  projectId,
  customQuestions,
}: {
  projectId: number;
  customQuestions: { id: number; difficulty: string; question: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [difficulty, setDifficulty] = useState("Medium");

  function handleSubmit(formData: FormData) {
    const question = String(formData.get("question") || "").trim();
    if (!question) return;
    startTransition(async () => {
      await addProjectQuestion(projectId, { difficulty, question });
      formRef.current?.reset();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {(["Easy", "Medium", "Hard", "Advanced"] as const).map((d) => {
        const custom = customQuestions.filter((q) => q.difficulty === d);
        return (
          <div key={d} className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">{d}</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {DEFAULT_PROMPTS[d].map((q) => (
                <li key={q} className="text-black/70 dark:text-white/70">
                  {q}
                </li>
              ))}
              {custom.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-2">
                  <span>{q.question}</span>
                  <form action={deleteInterviewQuestion.bind(null, q.id)}>
                    <button className="shrink-0 text-xs text-black/30 hover:text-red-600 dark:text-white/30 dark:hover:text-red-400">
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <form ref={formRef} action={handleSubmit} className="flex flex-wrap items-end gap-2 border-t border-black/10 pt-3 dark:border-white/10">
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
        >
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
          <option>Advanced</option>
        </select>
        <input
          name="question"
          placeholder="Add your own question they might ask"
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
    </div>
  );
}
