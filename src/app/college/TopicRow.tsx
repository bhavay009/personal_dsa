"use client";

import { useState, useTransition } from "react";
import { deleteTopic, updateTopicConfidence, updateTopicName } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function TopicRow({
  id,
  name,
  confidence,
  decayed,
  effectiveConfidence,
}: {
  id: number;
  name: string;
  confidence: number;
  decayed: boolean;
  effectiveConfidence: number;
}) {
  const [value, setValue] = useState(confidence);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function commit(next: number) {
    setValue(next);
    startTransition(() => updateTopicConfidence(id, next));
  }

  if (editing) {
    return (
      <form
        action={(formData: FormData) => {
          const nextName = String(formData.get("name") || "").trim();
          if (!nextName) return;
          startTransition(async () => {
            await updateTopicName(id, nextName);
            setEditing(false);
          });
        }}
        className="flex items-center gap-2 py-2"
      >
        <input
          name="name"
          defaultValue={name}
          required
          autoFocus
          className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
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
    <div className="flex items-center gap-3 py-2">
      <button onClick={() => setEditing(true)} className="w-40 shrink-0 truncate text-left text-sm hover:underline">
        {name}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={pending}
        onChange={(e) => setValue(Number(e.target.value))}
        onMouseUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => commit(Number((e.target as HTMLInputElement).value))}
        className="flex-1"
      />
      <span className={`w-14 shrink-0 text-right text-xs ${decayed ? "text-amber-600" : "text-black/50 dark:text-white/50"}`}>
        {decayed ? `${effectiveConfidence}%*` : `${value}%`}
      </span>
      <ConfirmDeleteButton
        action={deleteTopic.bind(null, id)}
        confirmMessage={`Delete topic "${name}"? This can't be undone.`}
        className="shrink-0 text-xs text-black/30 hover:text-red-600 dark:text-white/30 dark:hover:text-red-400"
      >
        ×
      </ConfirmDeleteButton>
    </div>
  );
}
