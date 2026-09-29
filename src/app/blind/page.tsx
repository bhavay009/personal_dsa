import Link from "next/link";
import { finishSession } from "@/app/actions";
import { prisma } from "@/lib/db";
import { getSessionReport } from "@/lib/session-engine";
import { SessionReportView } from "@/components/SessionReport";
import { EmptyState, PrimaryButton } from "@/components/ui";
import { BlockRunner } from "../today/BlockRunner";
import { StartBlindForm } from "./StartBlindForm";

export const dynamic = "force-dynamic";

export default async function BlindPage() {
  const plan = await prisma.sessionPlan.findFirst({
    where: { status: "Active", mode: "Blind" },
    orderBy: { date: "desc" },
    include: { blocks: { orderBy: { position: "asc" } } },
  });

  const lastCompleted = plan
    ? null
    : await prisma.sessionPlan.findFirst({
        where: { status: "Completed", mode: "Blind" },
        orderBy: { date: "desc" },
      });
  const lastReport = lastCompleted ? await getSessionReport(lastCompleted.id) : null;

  const problemIds = (plan?.blocks ?? []).map((b) => b.problemId).filter((id): id is number => id !== null);

  const [allProblems, problems, predictions] = await Promise.all([
    prisma.problem.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    problemIds.length ? prisma.problem.findMany({ where: { id: { in: problemIds } } }) : [],
    problemIds.length ? prisma.patternPrediction.findMany({ where: { problemId: { in: problemIds } } }) : [],
  ]);

  const problemById = new Map(problems.map((p) => [p.id, p]));
  const predicted = new Set(predictions.map((p) => p.problemId));

  const allSettled = Boolean(plan) && (plan?.blocks ?? []).every((b) => b.status !== "Pending");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Blind Test</h1>
        <p className="mt-1 text-sm text-muted">
          One problem, timed, no hints, no pattern label, no AI during the attempt. Pick a specific problem or let the
          engine choose one you&apos;ve actually applied before.
        </p>
      </div>

      {plan && (
        <div className="flex items-center justify-between rounded-lg border-2 border-accent bg-accent px-4 py-3 text-background">
          <span className="text-sm font-semibold uppercase tracking-wide">Blind Mode — AI assistance disabled</span>
          <span className="text-xs opacity-70">No hints · no pattern label · no solution</span>
        </div>
      )}

      {!plan && !lastReport && <StartBlindForm hasActivePlan={Boolean(plan)} problems={allProblems} />}

      {!plan && !lastReport && (
        <EmptyState title="Pick a problem, or don't" description="Leave it on 'Let the engine pick' and it chooses a pattern you've actually applied before." />
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
                revisionLevel={b.revisionLevel}
                revisionTargetId={b.revisionTargetId}
                rationale={b.rationale}
                status={b.status}
                mode="Blind"
                alreadyPredicted={b.problemId !== null && predicted.has(b.problemId)}
                problem={
                  problem
                    ? { id: problem.id, title: problem.title, url: problem.url, difficulty: problem.difficulty }
                    : null
                }
              />
            );
          })}

          {allSettled && plan && (
            <form action={finishSession.bind(null, plan.id)}>
              <PrimaryButton type="submit">Finish blind test</PrimaryButton>
            </form>
          )}
        </div>
      )}

      {lastReport && (
        <>
          <SessionReportView report={lastReport} />
          <StartBlindForm hasActivePlan={false} problems={allProblems} />
        </>
      )}

      <Link href="/today" className="self-start text-xs text-muted hover:text-foreground hover:underline">
        ← Back to today&apos;s session
      </Link>
    </div>
  );
}
