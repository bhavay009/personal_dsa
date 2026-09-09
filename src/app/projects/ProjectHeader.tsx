"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteProject, updateProjectMeta } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function ProjectHeader({
  id,
  name,
  description,
  techStack,
}: {
  id: number;
  name: string;
  description: string | null;
  techStack: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Link href="/projects" className="text-xs text-black/40 hover:underline dark:text-white/40">
          ← Projects
        </Link>
        {editing ? (
          <form
            action={(formData: FormData) => {
              const nextName = String(formData.get("name") || "").trim();
              if (!nextName) return;
              startTransition(async () => {
                await updateProjectMeta(id, {
                  name: nextName,
                  description: String(formData.get("description") || "").trim() || null,
                  techStack: String(formData.get("techStack") || "").trim() || null,
                });
                setEditing(false);
              });
            }}
            className="mt-1 flex flex-col gap-2"
          >
            <input
              name="name"
              defaultValue={name}
              required
              autoFocus
              className="rounded border border-black/15 bg-transparent px-2 py-1 text-lg font-semibold outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
            <input
              name="description"
              defaultValue={description ?? ""}
              placeholder="What problem does it solve?"
              className="rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
            <input
              name="techStack"
              defaultValue={techStack ?? ""}
              placeholder="Tech stack"
              className="rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="text-xs font-medium disabled:opacity-50">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-black/40 dark:text-white/40">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="text-xl font-semibold">{name}</h1>
            {description && <p className="text-sm text-black/60 dark:text-white/60">{description}</p>}
            {techStack && <p className="text-xs text-black/40 dark:text-white/40">{techStack}</p>}
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
          >
            Edit
          </button>
        )}
        <ConfirmDeleteButton
          action={deleteProject.bind(null, id)}
          confirmMessage={`Delete "${name}"? This also deletes its interview questions. This can't be undone.`}
          className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400"
        >
          Delete project
        </ConfirmDeleteButton>
      </div>
    </div>
  );
}
