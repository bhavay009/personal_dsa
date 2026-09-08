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

export async function getDocuments(docType: "Notes" | "PYQ" = "Notes") {
  const docs = await prisma.document.findMany({
    where: { docType },
    orderBy: [{ folder: "asc" }, { uploadedAt: "desc" }],
  });
  const byFolder = new Map<string, typeof docs>();
  for (const d of docs) {
    if (!byFolder.has(d.folder)) byFolder.set(d.folder, []);
    byFolder.get(d.folder)!.push(d);
  }
  return byFolder;
}

export async function searchDocuments(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  // FTS5 query syntax needs plain terms; wrap each word so punctuation in user input can't break it.
  const ftsQuery = trimmed
    .split(/\s+/)
    .map((w) => `"${w.replace(/"/g, '""')}"`)
    .join(" ");

  const rows = await prisma.$queryRaw<{ id: number; snippet: string }[]>`
    SELECT d.id as id, snippet(DocumentFts, 1, '**', '**', '…', 20) as snippet
    FROM DocumentFts
    JOIN Document d ON d.id = DocumentFts.rowid
    WHERE DocumentFts MATCH ${ftsQuery}
    ORDER BY rank
    LIMIT 15
  `;
  if (rows.length === 0) return [];

  const docs = await prisma.document.findMany({ where: { id: { in: rows.map((r) => r.id) } } });
  const docById = new Map(docs.map((d) => [d.id, d]));
  return rows.map((r) => ({ doc: docById.get(r.id)!, snippet: r.snippet })).filter((r) => r.doc);
}

// ---------- College ----------

export async function getSubjects() {
  return prisma.subject.findMany({
    orderBy: { name: "asc" },
    include: { topics: true, assignments: { where: { status: "Pending" } } },
  });
}

export async function getSubjectDetail(id: number) {
  return prisma.subject.findUnique({
    where: { id },
    include: { topics: { orderBy: { name: "asc" } }, assignments: { orderBy: { deadline: "asc" } } },
  });
}

export async function getUpcomingAssignments() {
  return prisma.assignment.findMany({
    where: { status: "Pending" },
    orderBy: { deadline: "asc" },
    include: { subject: true },
  });
}

const DECAY_DAYS = 21; // a topic not revised in this long starts showing as decaying

export function topicDecay(topic: { confidence: number; lastRevised: Date | null }) {
  if (!topic.lastRevised) return { decayed: false, effectiveConfidence: topic.confidence };
  const daysSince = Math.floor((Date.now() - topic.lastRevised.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince <= DECAY_DAYS) return { decayed: false, effectiveConfidence: topic.confidence };
  const decayedBy = Math.min(topic.confidence, Math.round((daysSince - DECAY_DAYS) * 1.5));
  return { decayed: true, effectiveConfidence: Math.max(0, topic.confidence - decayedBy) };
}

// ---------- Skills ----------

export async function getSkills() {
  const skills = await prisma.skill.findMany({ orderBy: { name: "asc" } });
  const byCategory = new Map<string, typeof skills>();
  for (const s of skills) {
    if (!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category)!.push(s);
  }
  return byCategory;
}

// ---------- Projects ----------

export async function getProjects() {
  return prisma.project.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getProjectDetail(id: number) {
  return prisma.project.findUnique({
    where: { id },
    include: { questions: { orderBy: { difficulty: "asc" } } },
  });
}

// ---------- Interview prep ----------

export async function getInterviewQuestions(category?: string) {
  return prisma.interviewQuestion.findMany({
    where: category ? { category } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function getInterviewSessions(limit = 20) {
  return prisma.interviewSession.findMany({ orderBy: { date: "desc" }, take: limit, include: { project: true } });
}

export async function getInterviewStatsByCategory() {
  const sessions = await prisma.interviewSession.findMany({ where: { mode: { not: "Mixed" } } });
  const byMode = new Map<string, { totalQ: number; correctQ: number }>();
  for (const s of sessions) {
    const cur = byMode.get(s.mode) ?? { totalQ: 0, correctQ: 0 };
    cur.totalQ += s.totalQ;
    cur.correctQ += s.correctQ;
    byMode.set(s.mode, cur);
  }
  return byMode;
}

// ---------- Applications ----------

export async function getApplications() {
  return prisma.application.findMany({ orderBy: { createdAt: "desc" } });
}

// ---------- Resume ----------

export async function getResumeVersions() {
  return prisma.document.findMany({ where: { docType: "Resume" }, orderBy: { uploadedAt: "desc" } });
}

const ACTION_VERBS = [
  "built",
  "designed",
  "implemented",
  "led",
  "optimized",
  "reduced",
  "increased",
  "improved",
  "created",
  "developed",
  "shipped",
  "architected",
  "automated",
  "migrated",
  "launched",
  "scaled",
];

export function analyzeResumeText(text: string) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const bulletLines = lines.filter((l) => /^[\s]*[•\-*▪]/.test(l));
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const bulletsWithMetrics = bulletLines.filter((l) => /\d/.test(l));
  const bulletsWithActionVerbs = bulletLines.filter((l) =>
    ACTION_VERBS.some((v) => new RegExp(`\\b${v}\\b`, "i").test(l)),
  );

  const findings: string[] = [];
  if (wordCount < 150) findings.push("Very short for a technical resume — most 1-pagers run 400-600 words.");
  if (wordCount > 900) findings.push("Long — consider trimming to fit one page.");
  if (bulletLines.length > 0) {
    const metricPct = Math.round((bulletsWithMetrics.length / bulletLines.length) * 100);
    if (metricPct < 40)
      findings.push(
        `Only ${metricPct}% of bullets have a number in them (${bulletsWithMetrics.length}/${bulletLines.length}) — quantify impact where you can.`,
      );
    const verbPct = Math.round((bulletsWithActionVerbs.length / bulletLines.length) * 100);
    if (verbPct < 50)
      findings.push(
        `Only ${verbPct}% of bullets open with a strong action verb (${bulletsWithActionVerbs.length}/${bulletLines.length}).`,
      );
  } else {
    findings.push("No bullet points detected — hard to scan quickly, consider a bulleted format.");
  }
  if (!/github\.com|linkedin\.com/i.test(text)) findings.push("No GitHub or LinkedIn link detected.");

  return { wordCount, bulletCount: bulletLines.length, findings };
}

export function compareJobDescription(jdText: string, trackedSkills: string[], trackedPatterns: string[]) {
  const jdLower = jdText.toLowerCase();
  const vocabulary = [...new Set([...trackedSkills, ...trackedPatterns])];
  const matched: string[] = [];
  const missing: string[] = [];
  for (const term of vocabulary) {
    const hit = new RegExp(`\\b${term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(jdLower);
    (hit ? matched : missing).push(term);
  }
  return { matched, missing };
}
