import Link from "next/link";
import { finishSession } from "@/app/actions";
import { prisma } from "@/lib/db";
import { getSessionReport } from "@/lib/session-engine";
import { SessionReportView } from "@/components/SessionReport";
import { EmptyState, PrimaryButton, SessionProgress } from "@/components/ui";
import { BlockRunner } from "../today/BlockRunner";
import { StartOaForm } from "./StartOaForm";

export const dynamic = "force-dynamic";

export default async function OaPage() {
  const plan = await prisma.sessionPlan.findFirst({
    where: { status: "Active", mode: "OA" },
    orderBy: { date: "desc" },
    include: { blocks: { orderBy: { position: "asc" } } },
  });

  const lastCompleted = plan
    ? null
    : await prisma.sessionPlan.findFirst({
        where: { status: "Completed", mode: "OA" },
        orderBy: { date: "desc" },
      });
  const lastReport = lastCompleted ? await getSessionReport(lastCompleted.id) : null;

  const problemIds = (plan?.blocks ?? []).map((b) => b.problemId).filter((id): id is number => id !== null);

  const [problems, predictions] = await Promise.all([
    problemIds.length ? prisma.problem.findMany({ where: { id: { in: problemIds } } }) : [],
    problemIds.length ? prisma.patternPrediction.findMany({ where: { problemId: { in: problemIds } } }) : [],
  ]);

  const problemById = new Map(problems.map((p) => [p.id, p]));
  const predicted = new Set(predictions.map((p) => p.problemId));

  const allSettled = Boolean(plan) && (plan?.blocks ?? []).every((b) => b.status !== "Pending");
  const doneCount = plan?.blocks.filter((b) => b.status !== "Pending").length ?? 0;
  const remainingMin = plan?.blocks.filter((b) => b.status === "Pending").reduce((sum, b) => sum + b.minutes, 0) ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Mock OA</h1>
        <p className="mt-1 text-sm text-muted">
          A timed, multi-problem mock exam. Problems are picked from your actual weakness/difficulty/pattern-distribution
          data, not randomized. No hints, no pattern labels — that&apos;s the point.
        </p>
      </div>

      {plan && (
        <div className="flex items-center justify-between rounded-lg border-2 border-accent bg-accent px-4 py-3 text-background">
          <span className="text-sm font-semibold uppercase tracking-wide">OA simulation in progress</span>
          <span className="text-xs opacity-70">No hints · no pattern labels</span>
        </div>
      )}

      {plan && <SessionProgress total={plan.blocks.length} doneCount={doneCount} minutesRemaining={remainingMin} />}

      {!plan && !lastReport && <StartOaForm hasActivePlan={Boolean(plan)} />}

      {!plan && !lastReport && (
        <EmptyState title="Pick a duration" description="The engine builds a mock exam from your weakness, difficulty, recent exposure, and pattern distribution — not a random pick." />
      )}

      {plan && (
        <div className="flex flex-col gap-3">
          {plan.blocks.map((b, i) => {
            const problem = b.problemId !== null ? problemById.get(b.problemId) : undefined;
            // Sequential like a real exam: a problem is locked until every problem
            // before it has been submitted (Done or Skipped).
            const locked = plan.blocks.slice(0, i).some((prior) => prior.status === "Pending");
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
                mode="OA"
                locked={locked}
                isCurrent={!locked && b.status === "Pending"}
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
              <PrimaryButton type="submit">Finish mock OA</PrimaryButton>
            </form>
          )}
        </div>
      )}

      {lastReport && (
        <>
          <SessionReportView report={lastReport} />
          <StartOaForm hasActivePlan={false} />
        </>
      )}

      <Link href="/today" className="self-start text-xs text-muted hover:text-foreground hover:underline">
        ← Back to today&apos;s session
      </Link>
    </div>
  );
}
