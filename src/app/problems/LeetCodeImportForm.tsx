"use client";

import { useState, useTransition } from "react";
import { importFromLeetCode } from "@/app/actions";

export function LeetCodeImportForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; skipped: number; error: string | null } | null>(null);

  function handleSubmit(formData: FormData) {
    const username = String(formData.get("username") || "");
    startTransition(async () => {
      const res = await importFromLeetCode(username);
      setResult(res);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start text-xs text-black/40 hover:text-black/70 hover:underline dark:text-white/40 dark:hover:text-white/70"
      >
        Import from LeetCode
      </button>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 text-sm dark:border-white/15"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="username"
          required
          placeholder="LeetCode username"
          className="rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Importing…" : "Import last 20 solves"}
        </button>
      </div>
      <p className="text-xs text-black/40 dark:text-white/40">
        Uses LeetCode&apos;s unofficial public API — it can change or block requests without notice. Add problems
        manually if this stops working.
      </p>
      {result && (
        <p className={`text-xs ${result.error ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>
          {result.error ?? `Imported ${result.imported}, skipped ${result.skipped} already-tracked problem${result.skipped === 1 ? "" : "s"}.`}
        </p>
      )}
    </form>
  );
}
