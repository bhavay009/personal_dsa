import Link from "next/link";
import { daysUntil, getUpcomingAssignments } from "@/lib/db";
import { getCurrentTopic, getCurriculumOverview, getJourneyDay, getTopicReadiness } from "@/lib/curriculum";
import { prisma } from "@/lib/db";
import { Panel, SectionLabel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

// §29/§30: the home page is about TODAY — Day N, the current topic, why it's
// the focus, and a short journey list. Solved/streak/career-readiness/export
// used to live here; they're real, but they're not the product, so they've
// moved to /mastery, /insights and NavBar's "More" menu instead of competing
// with the journey for the first thing a user sees.

export default async function DashboardPage() {
  const [journeyDay, currentTopic, overview, activePlan, assignments] = await Promise.all([
    getJourneyDay(),
    getCurrentTopic(),
    getCurriculumOverview(),
    prisma.sessionPlan.findFirst({ where: { status: "Active", mode: "Daily" }, include: { blocks: true } }),
    getUpcomingAssignments(),
  ]);

  const readiness = currentTopic ? await getTopicReadiness(currentTopic.key) : null;
  const nearestAssignment = assignments[0] ?? null;
  const assignmentDays = nearestAssignment ? daysUntil(nearestAssignment.deadline) : null;

  const firstUnmastered = overview.findIndex((t) => t.status !== "MASTERED");
  const journeyWindow = overview.slice(Math.max(0, firstUnmastered - 1), Math.max(0, firstUnmastered - 1) + 4);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div>
        <p className="text-sm text-muted">DAY {journeyDay} OF YOUR DSA JOURNEY</p>
        <h1 className="mt-1 text-2xl font-semibold">{currentTopic ? currentTopic.name : "Curriculum complete"}</h1>
        {readiness && <p className="mt-1 text-sm text-foreground/80">{readiness.recommendation}</p>}
      </div>

      <Link
        href="/today"
        className="flex flex-col items-center gap-1 rounded-lg bg-accent px-6 py-8 text-center text-background transition-opacity hover:opacity-90"
      >
        <span className="text-lg font-semibold">
          {activePlan ? "CONTINUE TODAY'S TRAINING" : !currentTopic?.startedAt ? `START DAY ${journeyDay}` : "START TODAY'S TRAINING"}
        </span>
        <span className="text-sm opacity-70">
          {currentTopic ? `Learn → Practice → Analyze → Improve on ${currentTopic.name}` : "Review anything, any time"}
        </span>
      </Link>

      {currentTopic && (
        <div>
          <SectionLabel>Today&apos;s focus</SectionLabel>
          <Panel className="mt-2 flex flex-col gap-1">
            <p className="text-sm font-medium">{currentTopic.name}</p>
            <p className="text-sm text-muted">
              <span className="font-semibold text-foreground/70">Why: </span>
              {currentTopic.whyItMatters}
            </p>
          </Panel>
        </div>
      )}

      {journeyWindow.length > 0 && (
        <div>
          <SectionLabel>Your journey</SectionLabel>
          <div className="mt-2 flex flex-col gap-1.5">
            {journeyWindow.map((t) => (
              <div key={t.key} className="flex items-center justify-between text-sm">
                <span className={t.key === currentTopic?.key ? "font-semibold" : "text-foreground/70"}>{t.name}</span>
                <StatusBadge
                  tone={t.status === "MASTERED" ? "success" : t.status === "READY" || t.status === "STRONG" ? "accent" : "neutral"}
                >
                  {/* "Mastered" implies the readiness gate was actually satisfied — a
                      manually-advanced topic says "Advanced" instead (§ terminology
                      refinement), consistent with /roadmap. */}
                  {t.status === "MASTERED" && t.overrideAdvanced ? "Advanced" : t.status}
                </StatusBadge>
              </div>
            ))}
          </div>
          <Link href="/roadmap" className="mt-2 inline-block text-xs text-muted hover:text-foreground hover:underline">
            See the full roadmap →
          </Link>
        </div>
      )}

      {nearestAssignment && assignmentDays !== null && (
        <Link href="/college" className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-border-strong">
          <span className="text-sm font-medium">
            {nearestAssignment.title} <span className="text-muted">— {nearestAssignment.subject.name}</span>
          </span>
          <span className={`text-sm font-semibold ${assignmentDays <= 2 ? "text-danger" : assignmentDays <= 7 ? "text-warning" : ""}`}>
            {assignmentDays < 0 ? "Overdue" : assignmentDays === 0 ? "Today" : `${assignmentDays}d`}
          </span>
        </Link>
      )}
    </div>
  );
}
