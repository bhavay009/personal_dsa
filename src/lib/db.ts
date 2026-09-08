import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import type { Outcome } from "@/lib/constants";

export * from "@/lib/constants";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// SM-2 spaced repetition (V1 upgrade from the fixed 1/3/7/14/30 schedule).
// Quality is derived from outcome + whether a mistake was tagged, since V0/V1's UI
// captures those rather than asking the user for a raw 0-5 self-rating.
export function outcomeToQuality(outcome: Outcome, mistakeTag: string | null): number {
  if (outcome === "Solved") return mistakeTag ? 4 : 5;
  if (outcome === "Partial") return 2;
  return 0; // Failed
}

export type Sm2State = { easeFactor: number; intervalDays: number; repetitions: number };

export function computeSm2Update(prev: Sm2State, quality: number, from: Date) {
  let { easeFactor, intervalDays, repetitions } = prev;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
    repetitions += 1;
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const nextRevision = new Date(from);
  nextRevision.setDate(nextRevision.getDate() + intervalDays);

  return { easeFactor, intervalDays, repetitions, nextRevision };
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

  const soonestExam = await prisma.exam.findFirst({
    where: { date: { gte: new Date() } },
    orderBy: { date: "asc" },
  });

  return {
    totalSolved,
    solvedThisWeek,
    revisionDueCount: revisionQueue.length,
    weakestTag,
    streak,
    soonestExam,
  };
}

export function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export async function getUpcomingExams() {
  return prisma.exam.findMany({ orderBy: { date: "asc" } });
}

export async function getDocuments() {
  const docs = await prisma.document.findMany({ orderBy: [{ folder: "asc" }, { uploadedAt: "desc" }] });
  const byFolder = new Map<string, typeof docs>();
  for (const d of docs) {
    if (!byFolder.has(d.folder)) byFolder.set(d.folder, []);
    byFolder.get(d.folder)!.push(d);
  }
  return byFolder;
}
