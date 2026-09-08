"use client";

import { useState, useTransition } from "react";
import { searchNotes } from "@/app/actions";

type Result = { doc: { id: number; originalName: string }; snippet: string };

function renderSnippet(snippet: string) {
  return snippet.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>));
}

export function SearchNotes() {
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<Result[] | null>(null);

  function handleSubmit(formData: FormData) {
    const query = String(formData.get("query") || "").trim();
    if (!query) {
      setResults(null);
      return;
    }
    startTransition(async () => {
      setResults(await searchNotes(query));
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <label className="text-xs text-black/50 dark:text-white/50">Ask My Notes — keyword search across uploaded PDFs</label>
      <div className="flex gap-2">
        <input
          name="query"
          placeholder="e.g. binary search tree"
          className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Searching…" : "Search"}
        </button>
      </div>
      {results &&
        (results.length === 0 ? (
          <p className="text-xs text-black/40 dark:text-white/40">No matches.</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
            {results.map((r) => (
              <a
                key={r.doc.id}
                href={`/api/files/${r.doc.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-0.5 py-2 text-sm hover:underline"
              >
                <span className="font-medium">{r.doc.originalName}</span>
                <span className="text-xs text-black/50 dark:text-white/50">{renderSnippet(r.snippet)}</span>
              </a>
            ))}
          </div>
        ))}
    </form>
  );
}
