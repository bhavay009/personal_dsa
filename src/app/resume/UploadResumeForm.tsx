"use client";

import { useRef, useTransition } from "react";
import { uploadResume } from "@/app/actions";

export function UploadResumeForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return;
    startTransition(async () => {
      await uploadResume(formData);
      formRef.current?.reset();
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-black/50 dark:text-white/50">Resume PDF</label>
        <input
          name="file"
          type="file"
          accept="application/pdf"
          required
          className="text-sm file:mr-3 file:rounded file:border-0 file:bg-black/10 file:px-3 file:py-1.5 file:text-xs dark:file:bg-white/15"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Uploading…" : "Upload version"}
      </button>
    </form>
  );
}
