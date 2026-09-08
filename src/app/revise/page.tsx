import { getRevisionQueue } from "@/lib/db";
import { RevisionRow } from "./RevisionRow";

export const dynamic = "force-dynamic";

export default async function RevisePage() {
  const due = await getRevisionQueue();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-semibold">Revise Today</h1>
      <p className="text-sm text-black/50 dark:text-white/50">
        {due.length === 0 ? "Nothing due — you're caught up." : `${due.length} problem${due.length === 1 ? "" : "s"} due for revision.`}
      </p>

      <div className="flex flex-col gap-3">
        {due.map((a) => (
          <RevisionRow
            key={a.problemId}
            problemId={a.problemId}
            title={a.problem.title}
            url={a.problem.url}
            pattern={a.problem.pattern}
            difficulty={a.problem.difficulty}
          />
        ))}
      </div>
    </div>
  );
}
