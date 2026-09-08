"use client";

import { useTransition } from "react";
import { updateProject } from "@/app/actions";

export function ProjectDetailForm({
  projectId,
  architecture,
  challenges,
  decisions,
  githubUrl,
  liveUrl,
}: {
  projectId: number;
  architecture: string;
  challenges: string;
  decisions: string;
  githubUrl: string;
  liveUrl: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(() =>
      updateProject(projectId, {
        architecture: String(formData.get("architecture") || ""),
        challenges: String(formData.get("challenges") || ""),
        decisions: String(formData.get("decisions") || ""),
        githubUrl: String(formData.get("githubUrl") || ""),
        liveUrl: String(formData.get("liveUrl") || ""),
      }),
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="githubUrl"
          defaultValue={githubUrl}
          placeholder="GitHub URL"
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <input
          name="liveUrl"
          defaultValue={liveUrl}
          placeholder="Live URL"
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-black/50 dark:text-white/50">Architecture</span>
        <textarea
          name="architecture"
          defaultValue={architecture}
          rows={3}
          placeholder="How is it structured? DB, APIs, auth, deployment…"
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-black/50 dark:text-white/50">Challenges</span>
        <textarea
          name="challenges"
          defaultValue={challenges}
          rows={3}
          placeholder="What was genuinely hard, and how did you solve it?"
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-black/50 dark:text-white/50">Technical decisions</span>
        <textarea
          name="decisions"
          defaultValue={decisions}
          rows={3}
          placeholder="Why this DB / framework / pattern over the alternatives?"
          className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
