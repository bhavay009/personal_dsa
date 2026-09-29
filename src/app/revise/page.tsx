import Link from "next/link";
import { getRevisionQueue } from "@/lib/db";
import type { RevisionLevelId } from "@/lib/revision";
import { EmptyState } from "@/components/ui";
import { RevisionRow } from "./RevisionRow";

export const dynamic = "force-dynamic";

export default async function RevisePage() {
  const due = await getRevisionQueue();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Review</h1>
        <p className="mt-1 text-sm text-muted">
          {due.length === 0
            ? "What needs attention today? Nothing, right now."
            : `What needs attention today? ${due.length} item${due.length === 1 ? "" : "s"}.`}
        </p>
      </div>

      {due.length === 0 && (
        <EmptyState
          title="You're clear"
          description="Nothing needs revision right now. Start today's training instead."
          action={
            <Link href="/today" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:opacity-90">
              Go to today&apos;s training
            </Link>
          }
        />
      )}

      <div className="flex flex-col gap-3">
        {due.map((a, i) => (
          <RevisionRow
            key={a.problemId}
            problemId={a.problemId}
            title={a.problem.title}
            url={a.problem.url}
            pattern={a.problem.pattern}
            difficulty={a.problem.difficulty}
            revisionLevel={a.problem.revisionLevel as RevisionLevelId}
            highlight={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
