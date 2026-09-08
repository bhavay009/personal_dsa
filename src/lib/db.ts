import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import type { Outcome } from "@/lib/constants";

export * from "@/lib/constants";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Fixed deterministic revision schedule (§10 of the PrepOS spec): 1 / 3 / 7 / 14 / 30 days.
// A Solved attempt advances one stage; anything else resets to stage 0 (review again tomorrow).
const REVISION_INTERVALS_DAYS = [1, 3, 7, 14, 30];

export async function getPriorStreak(problemId: number): Promise<number> {
  const attempts = await prisma.attempt.findMany({
    where: { problemId },
    orderBy: { date: "desc" },
    select: { outcome: true },
  });
  let streak = 0;
  for (const a of attempts) {
    if (a.outcome === "Solved") streak++;
    else break;
  }
  return streak;
}

export function computeNextRevision(priorStreak: number, outcome: Outcome, from: Date) {
  const newStreak = outcome === "Solved" ? Math.min(priorStreak + 1, REVISION_INTERVALS_DAYS.length) : 0;
  const dayOffset = REVISION_INTERVALS_DAYS[Math.max(newStreak - 1, 0)];
  const nextRevision = new Date(from);
  nextRevision.setDate(nextRevision.getDate() + dayOffset);
  return { nextRevision, newStreak };
}

export async function getRevisionQueue() {
  // Latest attempt per problem, where that attempt's nextRevision is due.
  const latestAttempts = await prisma.attempt.findMany({
    orderBy: { date: "desc" },
    include: { problem: true },
  });
  const seen = new Set<number>();
  const due: typeof latestAttempts = [];
  const now = new Date();
  for (const a of latestAttempts) {
    if (seen.has(a.problemId)) continue;
    seen.add(a.problemId);
    if (a.nextRevision && a.nextRevision <= now) due.push(a);
  }
  due.sort((a, b) => (a.nextRevision! < b.nextRevision! ? -1 : 1));
  return due;
}

export async function getDashboardStats() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [totalSolved, solvedThisWeek, revisionQueue, recentAttempts] = await Promise.all([
    prisma.problem.count({ where: { status: "Solved" } }),
    prisma.attempt.count({ where: { outcome: "Solved", date: { gte: weekAgo } } }),
    getRevisionQueue(),
    prisma.attempt.findMany({
      orderBy: { date: "desc" },
      take: 20,
      select: { mistakeTag: true },
    }),
  ]);

  const tagCounts = new Map<string, number>();
  let tagged = 0;
  for (const a of recentAttempts) {
    if (!a.mistakeTag) continue;
    tagged++;
    tagCounts.set(a.mistakeTag, (tagCounts.get(a.mistakeTag) ?? 0) + 1);
  }
  let weakestTag: { tag: string; pct: number } | null = null;
  for (const [tag, count] of tagCounts) {
    const pct = Math.round((count / tagged) * 100);
    if (!weakestTag || pct > weakestTag.pct) weakestTag = { tag, pct };
  }

  // Streak: consecutive days (ending today) with at least one attempt.
  const allDates = await prisma.attempt.findMany({ select: { date: true }, orderBy: { date: "desc" } });
  const daySet = new Set(allDates.map((a) => a.date.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalSolved,
    solvedThisWeek,
    revisionDueCount: revisionQueue.length,
    weakestTag,
    streak,
  };
}
