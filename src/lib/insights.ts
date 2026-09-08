import { prisma } from "@/lib/db";

// All heuristic, all explainable — no AI, no hidden weights the user can't see.
// See §34 of the product plan: "The score must be explainable. Do not create
// meaningless gamification."

export type ReadinessDimension = { label: string; pct: number; basis: string };

export async function getCareerReadiness(): Promise<{ overall: number; dimensions: ReadinessDimension[] }> {
  const [totalSolved, totalAttempts, solvedNoHint, topics, skills, projects, resumeCount] =
    await Promise.all([
      prisma.problem.count({ where: { status: "Solved" } }),
      prisma.attempt.count(),
      prisma.attempt.count({ where: { outcome: "Solved", mistakeTag: { notIn: ["needed-hint", "needed-solution"] } } }),
      prisma.topic.findMany({ select: { confidence: true, lastRevised: true } }),
      prisma.skill.findMany(),
      prisma.project.findMany(),
      prisma.document.count({ where: { docType: "Resume" } }),
    ]);

  const dsaVolume = Math.min(100, Math.round((totalSolved / 100) * 100));
  const dsaAccuracy = totalAttempts > 0 ? Math.round((solvedNoHint / totalAttempts) * 100) : 0;
  const dsaPct = totalAttempts > 0 ? Math.round(dsaVolume * 0.5 + dsaAccuracy * 0.5) : 0;

  const { topicDecay } = await import("@/lib/db");
  const csPct =
    topics.length > 0
      ? Math.round(topics.reduce((sum, t) => sum + topicDecay(t).effectiveConfidence, 0) / topics.length)
      : 0;

  const devPct = skills.length > 0 ? Math.round((skills.filter((s) => s.interviewReady).length / skills.length) * 100) : 0;

  const projectsWithDetail = projects.filter((p) => p.architecture && p.challenges && p.decisions);
  const projectsPct = projects.length > 0 ? Math.round((projectsWithDetail.length / projects.length) * 100) : 0;

  const sessions = await prisma.interviewSession.findMany();
  const sysDesignSessions = sessions.filter((s) => s.mode === "SystemDesign");
  const sysDesignPct =
    sysDesignSessions.length > 0
      ? Math.round(
          (sysDesignSessions.reduce((s, x) => s + x.correctQ, 0) / sysDesignSessions.reduce((s, x) => s + x.totalQ, 0)) *
            100,
        )
      : 0;

  const otherSessions = sessions.filter((s) => s.mode !== "SystemDesign" && s.mode !== "DSA");
  const interviewPct =
    otherSessions.length > 0
      ? Math.round(
          (otherSessions.reduce((s, x) => s + x.correctQ, 0) / otherSessions.reduce((s, x) => s + x.totalQ, 0)) * 100,
        )
      : 0;

  const resumePct = resumeCount > 0 ? 70 : 0; // presence-only signal; real score needs analyzeResumeText on a specific version

  const dims: ReadinessDimension[] = [
    { label: "DSA", pct: dsaPct, basis: `${totalSolved} solved, ${dsaAccuracy}% clean-solve rate` },
    { label: "CS Fundamentals", pct: csPct, basis: `${topics.length} topic${topics.length === 1 ? "" : "s"} tracked` },
    { label: "Development", pct: devPct, basis: `${skills.filter((s) => s.interviewReady).length}/${skills.length || 0} skills interview-ready` },
    { label: "Projects", pct: projectsPct, basis: `${projectsWithDetail.length}/${projects.length || 0} projects fully documented` },
    { label: "System Design", pct: sysDesignPct, basis: `${sysDesignSessions.length} practice session${sysDesignSessions.length === 1 ? "" : "s"}` },
    { label: "Interview", pct: interviewPct, basis: `${otherSessions.length} practice session${otherSessions.length === 1 ? "" : "s"} (non-DSA/SysDesign)` },
    { label: "Resume", pct: resumePct, basis: resumeCount > 0 ? `${resumeCount} version${resumeCount === 1 ? "" : "s"} uploaded` : "none uploaded" },
  ];

  const overall = dims.length > 0 ? Math.round(dims.reduce((s, d) => s + d.pct, 0) / dims.length) : 0;

  return { overall, dimensions: dims };
}

export async function getWeeklyReview() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const [thisWeekAttempts, lastWeekAttempts] = await Promise.all([
    prisma.attempt.findMany({ where: { date: { gte: weekAgo } } }),
    prisma.attempt.findMany({ where: { date: { gte: twoWeeksAgo, lt: weekAgo } } }),
  ]);

  const accuracy = (attempts: typeof thisWeekAttempts) =>
    attempts.length > 0 ? Math.round((attempts.filter((a) => a.outcome === "Solved").length / attempts.length) * 100) : null;

  const thisWeekAccuracy = accuracy(thisWeekAttempts);
  const lastWeekAccuracy = accuracy(lastWeekAttempts);

  const tagCounts = new Map<string, number>();
  for (const a of thisWeekAttempts) {
    if (!a.mistakeTag) continue;
    tagCounts.set(a.mistakeTag, (tagCounts.get(a.mistakeTag) ?? 0) + 1);
  }
  let weakestTag: string | null = null;
  let weakestCount = 0;
  for (const [tag, count] of tagCounts) {
    if (count > weakestCount) {
      weakestTag = tag;
      weakestCount = count;
    }
  }

  const upcomingExam = await prisma.exam.findFirst({ where: { date: { gte: now } }, orderBy: { date: "asc" } });

  return {
    problemsThisWeek: thisWeekAttempts.length,
    problemsLastWeek: lastWeekAttempts.length,
    thisWeekAccuracy,
    lastWeekAccuracy,
    weakestTag,
    upcomingExam,
  };
}

export async function getWhatAmIMissing(): Promise<string[]> {
  const gaps: string[] = [];

  const [skills, projects, resumeCount, behavioralSessions, subjects, dashboardAttempts, applications] =
    await Promise.all([
      prisma.skill.findMany(),
      prisma.project.findMany(),
      prisma.document.count({ where: { docType: "Resume" } }),
      prisma.interviewSession.count({ where: { mode: "Behavioral" } }),
      prisma.subject.findMany({ include: { topics: true } }),
      prisma.attempt.findMany({ select: { mistakeTag: true }, orderBy: { date: "desc" }, take: 30 }),
      prisma.application.count(),
    ]);

  const learnedNotReady = skills.filter((s) => s.learned && !s.interviewReady);
  if (learnedNotReady.length > 0) {
    gaps.push(
      `You've marked ${learnedNotReady.length} skill${learnedNotReady.length === 1 ? "" : "s"} as learned but not interview-ready: ${learnedNotReady.map((s) => s.name).join(", ")}.`,
    );
  }

  const tagCounts = new Map<string, number>();
  for (const a of dashboardAttempts) {
    if (a.mistakeTag) tagCounts.set(a.mistakeTag, (tagCounts.get(a.mistakeTag) ?? 0) + 1);
  }
  const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topTag && topTag[1] >= 3) {
    gaps.push(`"${topTag[0]}" shows up in ${topTag[1]} of your last 30 attempts — your most common mistake type.`);
  }

  if (projects.length > 0 && !projects.some((p) => p.challenges && p.decisions)) {
    gaps.push("You have projects logged but none have challenges/decisions filled in — hard to explain in interviews without that.");
  }

  if (behavioralSessions === 0) {
    gaps.push("No behavioral interview practice logged yet.");
  }

  if (resumeCount === 0) {
    gaps.push("No resume uploaded yet.");
  }

  for (const subject of subjects) {
    if (subject.topics.length === 0) continue;
    const avgConfidence = subject.topics.reduce((s, t) => s + t.confidence, 0) / subject.topics.length;
    if (avgConfidence < 50) {
      gaps.push(`${subject.name} has low average topic confidence (${Math.round(avgConfidence)}%).`);
    }
  }

  if (applications === 0) {
    gaps.push("No internship applications tracked yet.");
  }

  return gaps;
}

export type PlanItem = { label: string; minutes: number; reason: string; href: string };

export async function getSmartPlan(hoursAvailable: number, goal: string): Promise<PlanItem[]> {
  const budgetMin = Math.round(hoursAvailable * 60);
  const items: (PlanItem & { priority: number })[] = [];

  const { getRevisionQueue, getDashboardStats } = await import("@/lib/db");
  const [revisionQueue, stats, pendingAssignments, exam] = await Promise.all([
    getRevisionQueue(),
    getDashboardStats(),
    prisma.assignment.findMany({ where: { status: "Pending" }, orderBy: { deadline: "asc" }, take: 3, include: { subject: true } }),
    prisma.exam.findFirst({ where: { date: { gte: new Date() } }, orderBy: { date: "asc" } }),
  ]);

  if (revisionQueue.length > 0) {
    items.push({
      label: `Revise Today (${revisionQueue.length} problem${revisionQueue.length === 1 ? "" : "s"})`,
      minutes: Math.min(30, revisionQueue.length * 6),
      reason: "revision overdue",
      href: "/revise",
      priority: 100,
    });
  }

  if (stats.weakestTag) {
    items.push({
      label: `DSA practice — target "${stats.weakestTag.tag}" mistakes`,
      minutes: 45,
      reason: `weak pattern (${stats.weakestTag.pct}% of recent mistakes)`,
      href: "/problems",
      priority: 90,
    });
  } else if (goal === "DSA" || goal === "Mixed") {
    items.push({ label: "DSA practice", minutes: 45, reason: "primary prep goal", href: "/problems", priority: 70 });
  }

  if (exam) {
    const { daysUntil } = await import("@/lib/db");
    const days = daysUntil(exam.date);
    if (days <= 14) {
      items.push({
        label: `College — ${exam.name}`,
        minutes: 30,
        reason: `exam in ${days}d`,
        href: "/college",
        priority: days <= 5 ? 95 : 80,
      });
    }
  }

  for (const a of pendingAssignments) {
    const { daysUntil } = await import("@/lib/db");
    const days = daysUntil(a.deadline);
    if (days <= 7) {
      items.push({
        label: `Assignment — ${a.title} (${a.subject.name})`,
        minutes: a.estimateMin ?? 30,
        reason: `due in ${days}d`,
        href: "/college",
        priority: days <= 2 ? 95 : 75,
      });
    }
  }

  if (goal === "Development" || goal === "Mixed") {
    items.push({ label: "Development skill work", minutes: 30, reason: "career goal", href: "/skills", priority: 50 });
  }
  if (goal === "Internship" || goal === "Mixed") {
    items.push({ label: "Interview practice", minutes: 20, reason: "career goal", href: "/interview", priority: 55 });
  }

  items.sort((a, b) => b.priority - a.priority);

  const plan: PlanItem[] = [];
  let used = 0;
  for (const item of items) {
    if (used >= budgetMin) break;
    const minutes = Math.min(item.minutes, budgetMin - used);
    if (minutes <= 0) continue;
    plan.push({ label: item.label, minutes, reason: item.reason, href: item.href });
    used += minutes;
  }
  return plan;
}
