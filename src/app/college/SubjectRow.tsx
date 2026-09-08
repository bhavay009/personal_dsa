"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteSubject, updateSubject } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function SubjectRow({
  id,
  name,
  semester,
  topicCount,
  pendingAssignmentCount,
  decayedCount,
}: {
  id: number;
  name: string;
  semester: string | null;
  topicCount: number;
  pendingAssignmentCount: number;
  decayedCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        action={(formData: FormData) => {
          const nextName = String(formData.get("name") || "").trim();
          if (!nextName) return;
          startTransition(async () => {
            await updateSubject(id, { name: nextName, semester: String(formData.get("semester") || "").trim() || null });
            setEditing(false);
          });
        }}
        className="flex flex-wrap items-end gap-2 py-3"
      >
        <input
          name="name"
          defaultValue={name}
          required
          autoFocus
          className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <input
          name="semester"
          defaultValue={semester ?? ""}
          placeholder="Semester"
          className="w-28 rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <button type="submit" disabled={pending} className="text-xs font-medium disabled:opacity-50">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-black/40 dark:text-white/40">
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <Link href={`/college/${id}`} className="min-w-0">
        <div className="font-medium hover:underline">
          {name} {semester && <span className="text-xs text-black/40 dark:text-white/40">({semester})</span>}
        </div>
        <div className="text-xs text-black/50 dark:text-white/50">
          {topicCount} topic{topicCount === 1 ? "" : "s"}
          {pendingAssignmentCount > 0 && ` · ${pendingAssignmentCount} pending assignment${pendingAssignmentCount === 1 ? "" : "s"}`}
          {decayedCount > 0 && <span className="text-amber-600"> · {decayedCount} decaying</span>}
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
        >
          Edit
        </button>
        <ConfirmDeleteButton
          action={deleteSubject.bind(null, id)}
          confirmMessage={`Delete ${name}? This also deletes its topics and assignments. This can't be undone.`}
          className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400"
        />
      </div>
    </div>
  );
}
