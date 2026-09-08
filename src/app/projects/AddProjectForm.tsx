"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/actions";

export function AddProjectForm() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    startTransition(async () => {
      const id = await createProject({
        name,
        description: String(formData.get("description") || "").trim() || null,
        techStack: String(formData.get("techStack") || "").trim() || null,
      });
      router.push(`/projects/${id}`);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <input
        name="name"
        required
        autoFocus
        placeholder="Project name"
        className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <input
        name="description"
        placeholder="What problem does it solve? (one line)"
        className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <input
        name="techStack"
        placeholder="Tech stack (e.g. Next.js, Postgres, Redis)"
        className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Adding…" : "Add project"}
      </button>
    </form>
  );
}
