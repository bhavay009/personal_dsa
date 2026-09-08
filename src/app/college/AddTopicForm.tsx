"use client";

import { useRef, useTransition } from "react";
import { createTopic } from "@/app/actions";

export function AddTopicForm({ subjectId }: { subjectId: number }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    startTransition(async () => {
      await createTopic(subjectId, name);
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex gap-2">
      <input
        name="name"
        required
        placeholder="Add a topic (e.g. Transport Layer)"
        className="flex-1 rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
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
