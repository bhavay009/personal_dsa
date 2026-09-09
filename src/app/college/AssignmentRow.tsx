"use client";

import { useState, useTransition } from "react";
import { deleteAssignment, updateAssignment } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AssignmentToggle } from "./AssignmentToggle";

export function AssignmentRow({
  id,
  title,
  deadlineISO,
  priority,
  estimateMin,
  status,
  days,
}: {
  id: number;
  title: string;
  deadlineISO: string;
  priority: string;
  estimateMin: number | null;
  status: string;
  days: number;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        action={(formData: FormData) => {
          const nextTitle = String(formData.get("title") || "").trim();
          const nextDeadline = String(formData.get("deadline") || "");
          if (!nextTitle || !nextDeadline) return;
          const estimateRaw = formData.get("estimateMin");
          startTransition(async () => {
            await updateAssignment(id, {
              title: nextTitle,
              deadline: nextDeadline,
              priority: String(formData.get("priority") || priority),
              estimateMin: estimateRaw ? Number(estimateRaw) : null,
            });
            setEditing(false);
          });
        }}
        className="flex flex-wrap items-end gap-2 py-2"
      >
        <input
          name="title"
          defaultValue={title}
          required
          autoFocus
          className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <input
          name="deadline"
          type="date"
          defaultValue={deadlineISO}
          required
          className="rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
        />
        <select name="priority" defaultValue={priority} className="rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20">
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
        <input
          name="estimateMin"
          type="number"
          min={0}
          defaultValue={estimateMin ?? ""}
          placeholder="min"
          className="w-16 rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
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
    <div className="flex items-center justify-between gap-3 py-2">
      <label className="flex min-w-0 items-center gap-2 text-sm">
        <AssignmentToggle id={id} done={status === "Done"} />
        <span className={status === "Done" ? "text-black/40 line-through dark:text-white/40" : ""}>{title}</span>
        <span className="shrink-0 text-xs text-black/40 dark:text-white/40">{priority}</span>
      </label>
      <div className="flex shrink-0 items-center gap-3">
        {status === "Pending" && (
          <span className={days <= 2 ? "text-xs text-red-600" : "text-xs text-black/50 dark:text-white/50"}>
            {days < 0 ? "Overdue" : `${days}d`}
          </span>
        )}
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
        >
          Edit
        </button>
        <ConfirmDeleteButton
          action={deleteAssignment.bind(null, id)}
          confirmMessage={`Delete assignment "${title}"? This can't be undone.`}
          className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400"
        />
      </div>
    </div>
  );
}
