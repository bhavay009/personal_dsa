"use client";

import { useState, useTransition } from "react";
import { deleteApplication, updateApplication } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StageSelect } from "./StageSelect";

export function ApplicationRow({
  id,
  company,
  role,
  url,
  stage,
  referral,
}: {
  id: number;
  company: string;
  role: string;
  url: string | null;
  stage: string;
  referral: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        action={(formData: FormData) => {
          const nextCompany = String(formData.get("company") || "").trim();
          const nextRole = String(formData.get("role") || "").trim();
          if (!nextCompany || !nextRole) return;
          startTransition(async () => {
            await updateApplication(id, {
              company: nextCompany,
              role: nextRole,
              url: String(formData.get("url") || "").trim() || null,
            });
            setEditing(false);
          });
        }}
        className="flex flex-wrap items-end gap-2 py-3"
      >
        <input
          name="company"
          defaultValue={company}
          required
          autoFocus
          className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <input
          name="role"
          defaultValue={role}
          required
          className="min-w-0 flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <input
          name="url"
          defaultValue={url ?? ""}
          placeholder="URL"
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
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="font-medium">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
              {company}
            </a>
          ) : (
            company
          )}
        </div>
        <div className="text-xs text-black/50 dark:text-white/50">
          {role}
          {referral && " · referral"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
        >
          Edit
        </button>
        <StageSelect id={id} stage={stage} />
        <ConfirmDeleteButton
          action={deleteApplication.bind(null, id)}
          confirmMessage={`Delete the application to ${company}? This can't be undone.`}
          className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400"
        />
      </div>
    </div>
  );
}
