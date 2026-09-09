import Link from "next/link";
import { notFound } from "next/navigation";
import { daysUntil, getSubjectDetail, topicDecay } from "@/lib/db";
import { AddAssignmentForm } from "../AddAssignmentForm";
import { AddTopicForm } from "../AddTopicForm";
import { AssignmentRow } from "../AssignmentRow";
import { TopicRow } from "../TopicRow";

export const dynamic = "force-dynamic";

export default async function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subject = await getSubjectDetail(Number(id));
  if (!subject) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/college" className="text-xs text-black/40 hover:underline dark:text-white/40">
          ← College
        </Link>
        <h1 className="text-xl font-semibold">
          {subject.name} {subject.semester && <span className="text-sm font-normal text-black/40 dark:text-white/40">({subject.semester})</span>}
        </h1>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Topics</h2>
        <AddTopicForm subjectId={subject.id} />
        <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
          {subject.topics.length === 0 && <p className="py-3 text-sm text-black/50 dark:text-white/50">No topics yet.</p>}
          {subject.topics.map((t) => {
            const decay = topicDecay(t);
            return (
              <TopicRow
                key={t.id}
                id={t.id}
                name={t.name}
                confidence={t.confidence}
                decayed={decay.decayed}
                effectiveConfidence={decay.effectiveConfidence}
              />
            );
          })}
        </div>
        {subject.topics.some((t) => topicDecay(t).decayed) && (
          <p className="text-xs text-black/40 dark:text-white/40">* decayed — not revised in 3+ weeks, shown confidence is discounted</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Assignments</h2>
        <AddAssignmentForm subjectId={subject.id} />
        <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
          {subject.assignments.length === 0 && (
            <p className="py-3 text-sm text-black/50 dark:text-white/50">No assignments yet.</p>
          )}
          {subject.assignments.map((a) => (
            <AssignmentRow
              key={a.id}
              id={a.id}
              title={a.title}
              deadlineISO={a.deadline.toISOString().slice(0, 10)}
              priority={a.priority}
              estimateMin={a.estimateMin}
              status={a.status}
              days={daysUntil(a.deadline)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
