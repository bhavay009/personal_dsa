import { getCareerReadiness, getWeeklyReview, getWhatAmIMissing } from "@/lib/insights";
import { PlannerForm } from "./PlannerForm";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const [readiness, weekly, gaps] = await Promise.all([
    getCareerReadiness(),
    getWeeklyReview(),
    getWhatAmIMissing(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-semibold">Insights</h1>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Career readiness</h2>
          <span className="text-2xl font-semibold">{readiness.overall}%</span>
        </div>
        <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
          {readiness.dimensions.map((d) => (
            <div key={d.label} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <div>{d.label}</div>
                <div className="text-xs text-black/40 dark:text-white/40">{d.basis}</div>
              </div>
              <span className="font-medium">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">This week vs last week</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
            <div className="text-2xl font-semibold">{weekly.problemsThisWeek}</div>
            <div className="text-xs text-black/50 dark:text-white/50">Problems this week ({weekly.problemsLastWeek} last week)</div>
          </div>
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
            <div className="text-2xl font-semibold">
              {weekly.thisWeekAccuracy ?? "—"}
              {weekly.thisWeekAccuracy !== null && "%"}
            </div>
            <div className="text-xs text-black/50 dark:text-white/50">
              Accuracy{weekly.lastWeekAccuracy !== null ? ` (${weekly.lastWeekAccuracy}% last week)` : ""}
            </div>
          </div>
        </div>
        {weekly.weakestTag && (
          <p className="text-sm text-black/60 dark:text-white/60">Weakest mistake tag this week: {weekly.weakestTag}</p>
        )}
        {weekly.upcomingExam && (
          <p className="text-sm text-black/60 dark:text-white/60">Upcoming: {weekly.upcomingExam.name}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">What am I missing?</h2>
        {gaps.length === 0 ? (
          <p className="text-sm text-green-700 dark:text-green-400">No obvious gaps found — nice work.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-sm text-black/70 dark:text-white/70">
            {gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Smart daily planner</h2>
        <PlannerForm />
      </div>
    </div>
  );
}
