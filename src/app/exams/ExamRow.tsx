"use client";

import { useState, useTransition } from "react";
import { deleteExam, updateExam } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function ExamRow({
  id,
  name,
  dateISO,
  dateDisplay,
  days,
}: {
  id: number;
  name: string;
  dateISO: string;
  dateDisplay: string;
  days: number;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        action={(formData: FormData) => {
          const nextName = String(formData.get("name") || "").trim();
          const nextDate = String(formData.get("date") || "");
          if (!nextName || !nextDate) return;
          startTransition(async () => {
            await updateExam(id, { name: nextName, date: nextDate });
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
          name="date"
          type="date"
          defaultValue={dateISO}
          required
          className="rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
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
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-black/50 dark:text-white/50">{dateDisplay}</div>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={`text-sm font-medium ${
            days <= 3 ? "text-red-600" : days <= 10 ? "text-amber-600" : "text-black/60 dark:text-white/60"
          }`}
        >
          {days < 0 ? "Past" : days === 0 ? "Today" : `${days}d`}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
        >
          Edit
        </button>
        <ConfirmDeleteButton
          action={deleteExam.bind(null, id)}
          confirmMessage={`Delete "${name}"? This can't be undone.`}
          className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400"
        />
      </div>
    </div>
  );
}
