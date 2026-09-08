"use client";

import { useRef, useTransition } from "react";
import { createApplication } from "@/app/actions";

export function ApplicationForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const company = String(formData.get("company") || "").trim();
    const role = String(formData.get("role") || "").trim();
    if (!company || !role) return;
    startTransition(async () => {
      await createApplication({ company, role, url: String(formData.get("url") || "").trim() || null });
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-wrap items-end gap-2">
      <input
        name="company"
        placeholder="Company"
        required
        className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <input
        name="role"
        placeholder="Role"
        required
        className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <input
        name="url"
        placeholder="URL (optional)"
        className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        Add
      </button>
    </form>
  );
}
