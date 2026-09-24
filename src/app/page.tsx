import Link from "next/link";
import { daysUntil, getDashboardStats, getUpcomingAssignments, MISTAKE_TAGS } from "@/lib/db";
import { getCareerReadiness, getWhatAmIMissing } from "@/lib/insights";
import { getWeakestPattern } from "@/lib/mastery";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, readiness, gaps, assignments, weakest] = await Promise.all([
    getDashboardStats(),
    getCareerReadiness(),
    getWhatAmIMissing(),
    getUpcomingAssignments(),
    getWeakestPattern(),
  ]);
  const weakestLabel = stats.weakestTag
    ? MISTAKE_TAGS.find((t) => t.value === stats.weakestTag!.tag)?.label ?? stats.weakestTag.tag
    : null;
  const examDays = stats.soonestExam ? daysUntil(stats.soonestExam.date) : null;
  const nearestAssignment = assignments[0] ?? null;
  const assignmentDays = nearestAssignment ? daysUntil(nearestAssignment.deadline) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      {/* §6: the homepage revolves around START TODAY'S DSA — everything else here is secondary. */}
      <div className="flex flex-col gap-3 rounded-lg border border-black/15 p-5 dark:border-white/20">
        <div>
          <h1 className="text-xl font-semibold">Today&apos;s DSA</h1>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">
            {stats.revisionDueCount > 0
              ? `${stats.revisionDueCount} problem${stats.revisionDueCount === 1 ? "" : "s"} overdue for revision`
              : "Nothing overdue"}
            {weakest && weakest.priority === "HIGH" && ` · ${weakest.pattern} is the weakest tracked pattern`}
            {!weakest && " · no patterns tracked yet"}
            {" — the session engine composes today's hour from this, not a random pick."}
          </p>
        </div>
        <Link
          href="/today"
          className="self-start rounded bg-black px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          START TODAY&apos;S DSA
        </Link>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Quick actions</h2>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {weakestLabel && `Your weakest spot lately: ${weakestLabel} (${stats.weakestTag!.pct}% of recent mistakes).`}
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/revise"
          className="rounded border border-black/20 px-4 py-2 text-sm font-medium dark:border-white/25"
        >
          Revise Today {stats.revisionDueCount > 0 && `(${stats.revisionDueCount})`}
        </Link>
        <Link
          href="/problems"
          className="rounded border border-black/20 px-4 py-2 text-sm font-medium dark:border-white/25"
        >
          Log a problem
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Solved" value={stats.totalSolved} />
        <Stat label="This week" value={stats.solvedThisWeek} />
        <Stat label="Revise today" value={stats.revisionDueCount} />
        <Stat label="Streak" value={`${stats.streak}d`} />
      </div>

      <Link
        href="/insights"
        className="flex items-center justify-between rounded-lg border border-black/10 p-4 hover:border-black/25 dark:border-white/15 dark:hover:border-white/30"
      >
        <span className="text-sm font-medium">Career readiness</span>
        <span className="text-sm font-semibold">{readiness.overall}%</span>
      </Link>

      {stats.soonestExam && examDays !== null && (
        <Link
          href="/exams"
          className="flex items-center justify-between rounded-lg border border-black/10 p-4 hover:border-black/25 dark:border-white/15 dark:hover:border-white/30"
        >
          <span className="text-sm font-medium">{stats.soonestExam.name}</span>
          <span className={`text-sm font-semibold ${examDays <= 3 ? "text-red-600" : examDays <= 10 ? "text-amber-600" : ""}`}>
            {examDays === 0 ? "Today" : `${examDays}d`}
          </span>
        </Link>
      )}

      {nearestAssignment && assignmentDays !== null && (
        <Link
          href="/college"
          className="flex items-center justify-between rounded-lg border border-black/10 p-4 hover:border-black/25 dark:border-white/15 dark:hover:border-white/30"
        >
          <span className="text-sm font-medium">
            {nearestAssignment.title} <span className="text-black/40 dark:text-white/40">— {nearestAssignment.subject.name}</span>
          </span>
          <span className={`text-sm font-semibold ${assignmentDays <= 2 ? "text-red-600" : assignmentDays <= 7 ? "text-amber-600" : ""}`}>
            {assignmentDays < 0 ? "Overdue" : assignmentDays === 0 ? "Today" : `${assignmentDays}d`}
          </span>
        </Link>
      )}

      {gaps.length > 0 && (
        <Link
          href="/insights"
          className="self-start text-xs text-black/40 hover:text-black/70 hover:underline dark:text-white/40 dark:hover:text-white/70"
        >
          Biggest gap: {gaps[0]}
        </Link>
      )}

      <a
        href="/api/export"
        download
        className="self-start text-xs text-black/40 hover:text-black/70 hover:underline dark:text-white/40 dark:hover:text-white/70"
      >
        Export data (JSON backup)
      </a>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-black/50 dark:text-white/50">{label}</div>
    </div>
  );
}
