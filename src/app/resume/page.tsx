import { deleteDocument } from "@/app/actions";
import { analyzeResumeText, getResumeVersions } from "@/lib/db";
import { UploadResumeForm } from "./UploadResumeForm";
import { JdCompareForm } from "./JdCompareForm";

export const dynamic = "force-dynamic";

export default async function ResumePage() {
  const versions = await getResumeVersions();
  const latest = versions[0] ?? null;
  const analysis = latest?.extractedText ? analyzeResumeText(latest.extractedText) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-semibold">Resume</h1>
      <UploadResumeForm />

      {latest && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Latest: {latest.originalName}</h2>
          {analysis ? (
            <div className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 text-sm dark:border-white/15">
              <div className="text-xs text-black/50 dark:text-white/50">
                {analysis.wordCount} words · {analysis.bulletCount} bullet lines
              </div>
              {analysis.findings.length === 0 ? (
                <p className="text-green-700 dark:text-green-400">No issues found by the heuristic check.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-4">
                  {analysis.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-black/50 dark:text-white/50">
              Couldn&apos;t extract text from this PDF (scanned/image-only) — analysis unavailable.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Compare to a job description</h2>
        <JdCompareForm />
      </div>

      {versions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Versions</h2>
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
            {versions.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <a href={`/api/files/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline">
                  {d.originalName}
                </a>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-black/40 dark:text-white/40">{d.uploadedAt.toLocaleDateString()}</span>
                  <form action={deleteDocument.bind(null, d.id)}>
                    <button className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
