import { daysUntil, getUpcomingExams } from "@/lib/db";
import { ExamForm } from "./ExamForm";
import { ExamRow } from "./ExamRow";

export const dynamic = "force-dynamic";

export default async function ExamsPage() {
  const exams = await getUpcomingExams();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Exams</h1>
      <ExamForm />

      <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
        {exams.length === 0 && <p className="py-6 text-sm text-black/50 dark:text-white/50">No exams added yet.</p>}
        {exams.map((e) => (
          <ExamRow
            key={e.id}
            id={e.id}
            name={e.name}
            dateISO={e.date.toISOString().slice(0, 10)}
            dateDisplay={e.date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            days={daysUntil(e.date)}
          />
        ))}
      </div>
    </div>
  );
}
