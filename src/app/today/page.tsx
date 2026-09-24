import Link from "next/link";
import { finishSession } from "@/app/actions";
import { prisma } from "@/lib/db";
import { BlockRunner } from "./BlockRunner";
import { StartSessionForm } from "./StartSessionForm";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const plan = await prisma.sessionPlan.findFirst({
    where: { status: "Active" },
    orderBy: { date: "desc" },
    include: { blocks: { orderBy: { position: "asc" } } },
  });

  const problemIds = (plan?.blocks ?? [])
    .map((b) => b.problemId)
    .filter((id): id is number => id !== null);

  const [problems, predictions] = await Promise.all([
    problemIds.length ? prisma.problem.findMany({ where: { id: { in: problemIds } } }) : [],
    problemIds.length
      ? prisma.patternPrediction.findMany({ where: { problemId: { in: problemIds } } })
      : [],
  ]);

  const problemById = new Map(problems.map((p) => [p.id, p]));
  const predicted = new Set(predictions.map((p) => p.problemId));

  const planned = plan?.blocks.reduce((sum, b) => sum + b.minutes, 0) ?? 0;
  const doneMin =
    plan?.blocks.filter((b) => b.status === "Done").reduce((sum, b) => sum + b.minutes, 0) ?? 0;
  const allSettled = Boolean(plan) && (plan?.blocks ?? []).every((b) => b.status !== "Pending");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Today&apos;s DSA</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {plan
            ? `${planned} min planned · ${doneMin} min done. Every block below says why it's here.`
            : "One hour, composed from what you've actually been getting wrong."}
        </p>
      </div>

      <StartSessionForm hasActivePlan={Boolean(plan)} />

      {!plan && (
        <p className="text-sm text-black/50 dark:text-white/50">
          No active session. Pick your time and the engine will build one from your revision queue, weakest
          pattern, and hint dependency.
        </p>
      )}

      {plan && (
        <div className="flex flex-col gap-3">
          {plan.blocks.map((b) => {
            const problem = b.problemId !== null ? problemById.get(b.problemId) : undefined;
            return (
              <BlockRunner
                key={b.id}
                blockId={b.id}
                kind={b.kind}
                minutes={b.minutes}
                pattern={b.pattern}
                rationale={b.rationale}
                status={b.status}
                alreadyPredicted={b.problemId !== null && predicted.has(b.problemId)}
                problem={
                  problem
                    ? {
                        id: problem.id,
                        title: problem.title,
                        url: problem.url,
                        difficulty: problem.difficulty,
                      }
                    : null
                }
              />
            );
          })}

          {allSettled && plan && (
            <form action={finishSession.bind(null, plan.id)}>
              <button className="rounded border border-black/20 px-4 py-2 text-sm font-medium dark:border-white/25">
                Finish session
              </button>
            </form>
          )}
        </div>
      )}

      <Link
        href="/mastery"
        className="self-start text-xs text-black/40 hover:text-black/70 hover:underline dark:text-white/40 dark:hover:text-white/70"
      >
        See what the engine thinks you know →
      </Link>
    </div>
  );
}
