"use client";

import { useState, useTransition } from "react";
import { deleteTopic, updateTopicConfidence } from "@/app/actions";
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

  function commit(next: number) {
    setValue(next);
    startTransition(() => updateTopicConfidence(id, next));
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-40 shrink-0 truncate text-sm">{name}</span>
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
