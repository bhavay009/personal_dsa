import Link from "next/link";
import { finishSession } from "@/app/actions";
import { prisma } from "@/lib/db";
import { KIND_LABEL, KIND_PURPOSE } from "@/lib/block-labels";
import { REVISION_LEVELS, type RevisionLevelId } from "@/lib/revision";
import { getCurrentTopic, getJourneyDay, getNextTopic, getTopicReadiness, parseTopicList } from "@/lib/curriculum";
import { getConfusionFor, getPatternKnowledge, getPossibleTakeaways, getWhatToRemember, type PatternKnowledge } from "@/lib/pattern-knowledge";
import { getNotesFor } from "@/lib/notes";
import { EmptyState, Panel, PrimaryButton, SectionLabel, SessionProgress } from "@/components/ui";
import { TopicGate } from "@/components/TopicGate";
import { BlockRunner, type WhatToRememberClient } from "./BlockRunner";
import { StartSessionForm } from "./StartSessionForm";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [plan, currentTopicRow, journeyDay] = await Promise.all([
    prisma.sessionPlan.findFirst({
      where: { status: "Active", mode: "Daily" },
      orderBy: { date: "desc" },
      include: { blocks: { orderBy: { position: "asc" } } },
    }),
    getCurrentTopic(),
    getJourneyDay(),
  ]);

  const readiness = currentTopicRow ? await getTopicReadiness(currentTopicRow.key) : null;
  const nextTopic = currentTopicRow ? await getNextTopic(currentTopicRow.order) : null;
  const showLearnCard = Boolean(currentTopicRow && !currentTopicRow.startedAt && !plan);

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

  // Pattern Intelligence + Personal Notes (§3-§23): resolved per distinct
  // pattern/problem in this plan, not per block — a plan rarely has more than a
  // handful of blocks, so this stays cheap.
  const distinctPatterns = [...new Set(problems.map((p) => p.pattern))];
  const knowledgeByPattern = new Map<string, PatternKnowledge>();
  const confusionByPattern = new Map<string, { other: string; count: number }>();
  for (const pat of distinctPatterns) {
    const k = await getPatternKnowledge(pat);
    if (k) knowledgeByPattern.set(pat, k);
    const c = await getConfusionFor(pat);
    if (c) confusionByPattern.set(pat, { other: c.patternA === pat ? c.patternB : c.patternA, count: c.count });
  }

  const notesByProblem = new Map<number, { id: number; type: string; content: string; createdAt: string }[]>();
  const whatToRememberByProblem = new Map<number, WhatToRememberClient>();
  const suggestionsByProblem = new Map<number, string[]>();
  for (const pid of problemIds) {
    const rows = await getNotesFor({ problemId: pid });
    notesByProblem.set(
      pid,
      rows.map((r) => ({ id: r.id, type: r.type, content: r.content, createdAt: r.createdAt.toISOString() })),
    );
    const wtr = await getWhatToRemember(pid);
    if (wtr) whatToRememberByProblem.set(pid, wtr);
    const pat = problemById.get(pid)?.pattern;
    const knowledge = pat ? knowledgeByPattern.get(pat) : undefined;
    if (knowledge) suggestionsByProblem.set(pid, getPossibleTakeaways(knowledge));
  }

  const planned = plan?.blocks.reduce((sum, b) => sum + b.minutes, 0) ?? 0;
  const doneBlocks = plan?.blocks.filter((b) => b.status === "Done") ?? [];
  const doneMin = doneBlocks.reduce((sum, b) => sum + b.minutes, 0);
  const remainingMin = planned - doneMin;
  const allSettled = Boolean(plan) && (plan?.blocks ?? []).every((b) => b.status !== "Pending");

  // The first not-yet-settled block is what the plan itself considers most
  // important right now — composeSession already orders blocks by priority
  // (overdue revision → weakest pattern → hint dependency → transfer → new
  // material), so blocks[0] IS "today's focus", not a separate query.
  const currentBlock = plan?.blocks.find((b) => b.status === "Pending");
  const focusBlock = plan?.blocks[0];
  const focusLabel = focusBlock
    ? focusBlock.revisionLevel
      ? REVISION_LEVELS[focusBlock.revisionLevel as RevisionLevelId].name
      : (KIND_LABEL[focusBlock.kind] ?? focusBlock.kind)
    : null;

  const goalChain: string[] = [];
  for (const b of plan?.blocks ?? []) {
    const label = KIND_PURPOSE[b.kind] ?? b.kind;
    if (goalChain[goalChain.length - 1] !== label) goalChain.push(label);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-sm text-muted">DAY {journeyDay}</p>
        <h1 className="mt-1 text-2xl font-semibold">{currentTopicRow ? currentTopicRow.name : "Curriculum complete"}</h1>
        {readiness && <p className="mt-1 text-sm text-muted">{readiness.recommendation}</p>}
      </div>

      {showLearnCard && currentTopicRow && (
        <Panel className="flex flex-col gap-3">
          <SectionLabel>Learn — {currentTopicRow.name}</SectionLabel>
          <p className="text-sm text-foreground/80">{currentTopicRow.overview}</p>
          <p className="text-sm text-foreground/80">
            <span className="font-semibold">Why it matters: </span>
            {currentTopicRow.whyItMatters}
          </p>
          <LearnBullets title="Core concepts" items={parseTopicList(currentTopicRow.coreConcepts)} />
          <LearnBullets title="Key patterns" items={parseTopicList(currentTopicRow.keyPatterns)} />
          <LearnBullets title="Common mistakes" items={parseTopicList(currentTopicRow.commonMistakes)} />
          <p className="text-sm font-medium">Let&apos;s see if you understood it.</p>
        </Panel>
      )}

      {!plan && (
        <>
          <StartSessionForm hasActivePlan={false} />
          <EmptyState
            title="No active session yet"
            description="Pick your available time and the engine builds today's plan around your current topic, revision queue, and any weakness that needs attention — not a random pick."
          />
        </>
      )}

      {plan && (
        <>
          <div className="rounded-lg border border-border-strong bg-surface p-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-3xl font-semibold tabular-nums">{remainingMin}</span>
              <span className="text-sm text-muted">min remaining</span>
            </div>
            {focusBlock && (
              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Focus</p>
                  <p className="mt-0.5 text-base font-medium">
                    {focusBlock.pattern ? `${focusBlock.pattern} — ${focusLabel}` : focusLabel}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Why</p>
                  <p className="mt-0.5 text-sm text-foreground/80">{focusBlock.rationale}</p>
                </div>
                {goalChain.length > 1 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Today&apos;s goal</p>
                    <p className="mt-0.5 text-sm font-medium">{goalChain.join(" → ")}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <SessionProgress total={plan.blocks.length} doneCount={doneBlocks.length} minutesRemaining={remainingMin} />

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
                  mode="Daily"
                  isCurrent={currentBlock?.id === b.id}
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
                  patternKnowledge={b.pattern ? (knowledgeByPattern.get(b.pattern) ?? null) : null}
                  confusion={b.pattern ? (confusionByPattern.get(b.pattern) ?? null) : null}
                  notes={problem ? (notesByProblem.get(problem.id) ?? []) : []}
                  whatToRemember={problem ? (whatToRememberByProblem.get(problem.id) ?? null) : null}
                  suggestedTakeaways={problem ? (suggestionsByProblem.get(problem.id) ?? []) : []}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <StartSessionForm hasActivePlan compact />
            {allSettled && (
              <form action={finishSession.bind(null, plan.id)}>
                <PrimaryButton type="submit">Finish session</PrimaryButton>
              </form>
            )}
          </div>
        </>
      )}

      {currentTopicRow && readiness && (
        <TopicGate
          topicKey={currentTopicRow.key}
          topicName={currentTopicRow.name}
          ready={readiness.status === "READY"}
          gaps={readiness.gaps}
          nextTopicName={nextTopic?.name ?? null}
        />
      )}

      <div className="flex items-center justify-between text-xs">
        <Link href="/roadmap" className="text-muted hover:text-foreground hover:underline">
          ← Full roadmap
        </Link>
        <Link href="/mastery" className="text-muted hover:text-foreground hover:underline">
          See what the engine thinks you know →
        </Link>
      </div>
    </div>
  );
}

function LearnBullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-foreground/80">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
