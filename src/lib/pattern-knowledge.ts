import { prisma } from "@/lib/db";
import { PATTERN_KNOWLEDGE, PATTERN_QUIZ, type QuizQuestion } from "@/lib/pattern-knowledge-data";
import { MISTAKE_TAGS } from "@/lib/constants";

// Pattern Intelligence resolution (§3-§12, §25-§28 of the pattern-intelligence
// spec). Canonical knowledge is deterministic, curated data — no LLM is
// configured in this app, so there is no "AI Pattern Coach" call here; the
// deterministic content plays that role, same principle as session-engine's
// rule-based composition and getSessionReport's rule-based summary.

export type PatternKnowledge = {
  key: string;
  whatItIs: string;
  signals: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  coreIdea: string;
  invariant: string;
  template: string;
  commonTraps: string[];
  relatedPatterns: string[];
  interviewTakeaway: string;
  commonVariants: string[];
};

function parseList(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Self-heals a fresh dev.db, same pattern as ensureCurriculumSeeded. Guards
// against the same concurrent-seed race (two parallel reads both seeing
// count===0) by treating a unique-constraint violation as "already seeded".
export async function ensurePatternKnowledgeSeeded(): Promise<void> {
  const count = await prisma.patternKnowledge.count();
  if (count > 0) return;
  try {
    await prisma.patternKnowledge.createMany({
      data: PATTERN_KNOWLEDGE.map((p) => ({
        key: p.key,
        whatItIs: p.whatItIs,
        signals: JSON.stringify(p.signals),
        whenToUse: JSON.stringify(p.whenToUse),
        whenNotToUse: JSON.stringify(p.whenNotToUse),
        coreIdea: p.coreIdea,
        invariant: p.invariant,
        template: p.template,
        commonTraps: JSON.stringify(p.commonTraps),
        relatedPatterns: JSON.stringify(p.relatedPatterns),
        interviewTakeaway: p.interviewTakeaway,
        commonVariants: p.commonVariants ? JSON.stringify(p.commonVariants) : null,
      })),
    });
  } catch (err) {
    const isUniqueConstraintViolation = err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
    if (!isUniqueConstraintViolation) throw err;
  }
}

function toKnowledge(row: {
  key: string;
  whatItIs: string;
  signals: string;
  whenToUse: string;
  whenNotToUse: string;
  coreIdea: string;
  invariant: string;
  template: string;
  commonTraps: string;
  relatedPatterns: string;
  interviewTakeaway: string;
  commonVariants: string | null;
}): PatternKnowledge {
  return {
    key: row.key,
    whatItIs: row.whatItIs,
    signals: parseList(row.signals),
    whenToUse: parseList(row.whenToUse),
    whenNotToUse: parseList(row.whenNotToUse),
    coreIdea: row.coreIdea,
    invariant: row.invariant,
    template: row.template,
    commonTraps: parseList(row.commonTraps),
    relatedPatterns: parseList(row.relatedPatterns),
    interviewTakeaway: row.interviewTakeaway,
    commonVariants: row.commonVariants ? parseList(row.commonVariants) : [],
  };
}

export async function getPatternKnowledge(key: string): Promise<PatternKnowledge | null> {
  await ensurePatternKnowledgeSeeded();
  const row = await prisma.patternKnowledge.findUnique({ where: { key } });
  return row ? toKnowledge(row) : null;
}

export async function getAllPatternKnowledge(): Promise<PatternKnowledge[]> {
  await ensurePatternKnowledgeSeeded();
  const rows = await prisma.patternKnowledge.findMany({ orderBy: { key: "asc" } });
  return rows.map(toKnowledge);
}

// A curated, unrendered clue set for the "HELP ME RECOGNIZE THE PATTERN" button
// (§2) — signals + whenToUse only, deliberately never the pattern's own name,
// so recognition still has to happen before the label is confirmed.
export async function getRecognitionClues(key: string): Promise<{ signals: string[]; whenToUse: string[] } | null> {
  const k = await getPatternKnowledge(key);
  if (!k) return null;
  return { signals: k.signals, whenToUse: k.whenToUse };
}

export function getQuizForPattern(key: string): QuizQuestion[] {
  return PATTERN_QUIZ[key] ?? [];
}

// §35: mistake-tag-driven guidance for the "WHAT TO REMEMBER" card — reuses the
// same MISTAKE_TAGS vocabulary the rest of the app already tags attempts with.
export function getMistakeGuidance(mistakeTag: string | null): string | null {
  if (!mistakeTag) return null;
  if (mistakeTag === "pattern-recognition") return "Your main takeaway should focus on recognizing the pattern, not the implementation.";
  if (mistakeTag === "algorithm-selection" || mistakeTag === "concept" || mistakeTag === "forgot-concept")
    return "The pattern was named correctly but the underlying idea wasn't solid — focus your note on the core idea and invariant.";
  if (mistakeTag === "coding" || mistakeTag === "logic" || mistakeTag === "debugging")
    return "Your pattern was correct. Focus on the implementation invariant, not pattern recognition.";
  if (mistakeTag === "edge-case") return "Add this edge case to your personal notes — recognition and implementation weren't the problem.";
  return null;
}

// §23: the compact post-problem learning card. Deterministic, built from
// canonical PatternKnowledge + the single most recent attempt/mistake — never a
// full solution (§24).
export type WhatToRemember = {
  pattern: string;
  trigger: string | null;
  mentalModel: string;
  invariant: string;
  commonTrap: string | null;
  relatedPattern: string | null;
  nextPractice: string;
  mistakeGuidance: string | null;
};

export async function getWhatToRemember(problemId: number): Promise<WhatToRemember | null> {
  const problem = await prisma.problem.findUnique({ where: { id: problemId }, select: { pattern: true } });
  if (!problem) return null;
  const knowledge = await getPatternKnowledge(problem.pattern);
  if (!knowledge) return null;

  const latestAttempt = await prisma.attempt.findFirst({
    where: { problemId },
    orderBy: { date: "desc" },
    select: { mistakeTag: true },
  });

  return {
    pattern: knowledge.key,
    trigger: knowledge.signals[0] ?? null,
    mentalModel: knowledge.coreIdea,
    invariant: knowledge.invariant,
    commonTrap: knowledge.commonTraps[0] ?? null,
    relatedPattern: knowledge.relatedPatterns[0] ?? null,
    nextPractice: `Different-surface ${knowledge.key} problem`,
    mistakeGuidance: getMistakeGuidance(latestAttempt?.mistakeTag ?? null),
  };
}

// §21: suggested takeaways — never auto-saved, always require an explicit
// "Add to My Notes" click. Derived from canonical content, not an LLM call.
export function getPossibleTakeaways(knowledge: PatternKnowledge): string[] {
  return [knowledge.interviewTakeaway, ...knowledge.commonTraps.map((t) => `Watch for: ${t}`)];
}

// §13: pattern confusion, detected from actual PatternPrediction evidence — a
// wrong prediction where the predicted pattern and the actual pattern form a
// repeating pair. Threshold matches this app's existing MIN_EVIDENCE convention
// (mastery.ts) — fewer than 3 total mix-ups between a pair isn't a pattern yet.
export type PatternConfusion = { patternA: string; patternB: string; count: number };

export async function detectPatternConfusion(): Promise<PatternConfusion[]> {
  const wrongPredictions = await prisma.patternPrediction.findMany({
    where: { correct: false },
    select: { predicted: true, actual: true },
  });

  const pairCounts = new Map<string, { patternA: string; patternB: string; count: number }>();
  for (const p of wrongPredictions) {
    if (p.predicted === p.actual) continue;
    const [a, b] = [p.predicted, p.actual].sort();
    const key = `${a}|${b}`;
    const existing = pairCounts.get(key);
    if (existing) existing.count++;
    else pairCounts.set(key, { patternA: a, patternB: b, count: 1 });
  }

  return [...pairCounts.values()].filter((p) => p.count >= 3).sort((a, b) => b.count - a.count);
}

export async function getConfusionFor(patternKey: string): Promise<PatternConfusion | null> {
  const all = await detectPatternConfusion();
  return all.find((c) => c.patternA === patternKey || c.patternB === patternKey) ?? null;
}

export const MISTAKE_TAG_LABELS = MISTAKE_TAGS;
