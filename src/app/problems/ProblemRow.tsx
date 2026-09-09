"use client";

import { useState, useTransition } from "react";
import { deleteProblem, updateProblem } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { DIFFICULTIES, PATTERNS } from "@/lib/constants";

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "Solved"
      ? "text-green-700 dark:text-green-400"
      : status === "Attempted"
        ? "text-amber-600"
        : "text-black/40 dark:text-white/40";
  return <span className={`text-[10px] font-medium uppercase tracking-wide ${color}`}>{status}</span>;
}

export function ProblemRow({
  id,
  title,
  url,
  pattern,
  difficulty,
  status,
  lastMistake,
}: {
  id: number;
  title: string;
  url: string | null;
  pattern: string;
  difficulty: string;
  status: string;
  lastMistake: string | null | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        action={(formData: FormData) => {
          const nextTitle = String(formData.get("title") || "").trim();
          if (!nextTitle) return;
          startTransition(async () => {
            await updateProblem(id, {
              title: nextTitle,
              url: String(formData.get("url") || "").trim() || null,
              pattern: String(formData.get("pattern") || pattern),
              difficulty: String(formData.get("difficulty") || difficulty),
            });
            setEditing(false);
          });
        }}
        className="flex flex-wrap items-end gap-2 py-3"
      >
        <input
          name="title"
          defaultValue={title}
          required
          autoFocus
          className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <input
          name="url"
          defaultValue={url ?? ""}
          placeholder="Link"
          className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <select name="pattern" defaultValue={pattern} className="rounded border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20">
          {PATTERNS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select name="difficulty" defaultValue={difficulty} className="rounded border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20">
          {DIFFICULTIES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
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
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline">
              {title}
            </a>
          ) : (
            <span className="truncate font-medium">{title}</span>
          )}
          <StatusBadge status={status} />
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-black/50 dark:text-white/50">
          <span>{pattern}</span>
          <span>·</span>
          <span>{difficulty}</span>
          {lastMistake && (
            <>
              <span>·</span>
              <span className="text-amber-600">{lastMistake}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
        >
          Edit
        </button>
        <ConfirmDeleteButton
          action={deleteProblem.bind(null, id)}
          confirmMessage={`Delete "${title}"? This also deletes its attempt history. This can't be undone.`}
          className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400"
        >
          Delete
        </ConfirmDeleteButton>
      </div>
    </div>
  );
}
