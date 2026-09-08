import { deleteDocument } from "@/app/actions";
import { getDocuments } from "@/lib/db";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { UploadForm } from "./UploadForm";
import { SearchNotes } from "./SearchNotes";

export const dynamic = "force-dynamic";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function LibraryPage() {
  const byFolder = await getDocuments();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Library</h1>
      <UploadForm />
      <SearchNotes />

      {byFolder.size === 0 && <p className="text-sm text-black/50 dark:text-white/50">No PDFs uploaded yet.</p>}

      {[...byFolder.entries()].map(([folder, docs]) => (
        <div key={folder} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">{folder}</h2>
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <a
                  href={`/api/files/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate text-sm hover:underline"
                >
                  {d.originalName}
                </a>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-black/40 dark:text-white/40">{formatSize(d.sizeBytes)}</span>
                  <ConfirmDeleteButton
                    action={deleteDocument.bind(null, d.id)}
                    confirmMessage={`Delete "${d.originalName}"? This can't be undone.`}
                    className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
