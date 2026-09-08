import { deleteInterviewQuestion } from "@/app/actions";
import { getInterviewQuestions, getInterviewSessions, getInterviewStatsByCategory } from "@/lib/db";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { QuestionForm } from "./QuestionForm";
import { SessionForm } from "./SessionForm";

export const dynamic = "force-dynamic";

export default async function InterviewPage() {
  const [questions, sessions, statsByCategory] = await Promise.all([
    getInterviewQuestions(),
    getInterviewSessions(),
    getInterviewStatsByCategory(),
  ]);

  const byCategory = new Map<string, typeof questions>();
  for (const q of questions) {
    if (!byCategory.has(q.category)) byCategory.set(q.category, []);
    byCategory.get(q.category)!.push(q);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-semibold">Interview Prep</h1>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Practice session</h2>
        <SessionForm />
      </div>

      {statsByCategory.size > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Accuracy by category</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[...statsByCategory.entries()].map(([mode, s]) => (
              <div key={mode} className="rounded-lg border border-black/10 p-3 dark:border-white/15">
                <div className="text-lg font-semibold">{s.totalQ > 0 ? Math.round((s.correctQ / s.totalQ) * 100) : 0}%</div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {mode} ({s.totalQ} asked)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Question bank</h2>
        <QuestionForm />
        {byCategory.size === 0 && (
          <p className="py-4 text-sm text-black/50 dark:text-white/50">No questions added yet.</p>
        )}
        {[...byCategory.entries()].map(([category, qs]) => (
          <div key={category} className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-black/40 dark:text-white/40">{category}</h3>
            <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
              {qs.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    {q.question} <span className="text-xs text-black/40 dark:text-white/40">({q.difficulty})</span>
                  </span>
                  <ConfirmDeleteButton
                    action={deleteInterviewQuestion.bind(null, q.id)}
                    confirmMessage="Delete this question? This can't be undone."
                    className="shrink-0 text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {sessions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Recent sessions</h2>
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  {s.mode}
                  {s.project && ` — ${s.project.name}`}
                  {s.notes && <span className="text-black/40 dark:text-white/40"> · {s.notes}</span>}
                </span>
                <span className="shrink-0 text-xs text-black/50 dark:text-white/50">
                  {s.correctQ}/{s.totalQ} · {s.date.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
