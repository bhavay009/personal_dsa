import { deleteExam } from "@/app/actions";
import { daysUntil, getUpcomingExams } from "@/lib/db";
import { ExamForm } from "./ExamForm";

export const dynamic = "force-dynamic";

export default async function ExamsPage() {
  const exams = await getUpcomingExams();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Exams</h1>
      <ExamForm />

      <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
        {exams.length === 0 && <p className="py-6 text-sm text-black/50 dark:text-white/50">No exams added yet.</p>}
        {exams.map((e) => {
          const days = daysUntil(e.date);
          return (
            <div key={e.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {e.date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`text-sm font-medium ${
                    days <= 3 ? "text-red-600" : days <= 10 ? "text-amber-600" : "text-black/60 dark:text-white/60"
                  }`}
                >
                  {days < 0 ? "Past" : days === 0 ? "Today" : `${days}d`}
                </span>
                <form action={deleteExam.bind(null, e.id)}>
                  <button className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
