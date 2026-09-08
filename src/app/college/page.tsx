import Link from "next/link";
import { deleteSubject } from "@/app/actions";
import { daysUntil, getSubjects, getUpcomingAssignments, topicDecay } from "@/lib/db";
import { SubjectForm } from "./SubjectForm";

export const dynamic = "force-dynamic";

export default async function CollegePage() {
  const [subjects, assignments] = await Promise.all([getSubjects(), getUpcomingAssignments()]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">College</h1>
      <SubjectForm />

      {assignments.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Upcoming deadlines</h2>
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
            {assignments.map((a) => {
              const days = daysUntil(a.deadline);
              return (
                <div key={a.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>
                    {a.title} <span className="text-black/40 dark:text-white/40">— {a.subject.name}</span>
                  </span>
                  <span className={days <= 2 ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-black/50 dark:text-white/50"}>
                    {days < 0 ? "Overdue" : days === 0 ? "Today" : `${days}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
        {subjects.length === 0 && <p className="py-6 text-sm text-black/50 dark:text-white/50">No subjects added yet.</p>}
        {subjects.map((s) => {
          const decayedCount = s.topics.filter((t) => topicDecay(t).decayed).length;
          return (
            <div key={s.id} className="flex items-center justify-between gap-3 py-3">
              <Link href={`/college/${s.id}`} className="min-w-0">
                <div className="font-medium hover:underline">
                  {s.name} {s.semester && <span className="text-xs text-black/40 dark:text-white/40">({s.semester})</span>}
                </div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {s.topics.length} topic{s.topics.length === 1 ? "" : "s"}
                  {s.assignments.length > 0 && ` · ${s.assignments.length} pending assignment${s.assignments.length === 1 ? "" : "s"}`}
                  {decayedCount > 0 && <span className="text-amber-600"> · {decayedCount} decaying</span>}
                </div>
              </Link>
              <form action={deleteSubject.bind(null, s.id)}>
                <button className="shrink-0 text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400">
                  Delete
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
