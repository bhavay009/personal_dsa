import { prisma } from "@/lib/db";

// Personal Notes (§14-§22 of the pattern-intelligence spec). Deliberately one
// generic UserNote shape rather than separate ProblemNote/PatternNote/TopicNote
// tables — the shape is identical, only which scope field is set differs. This
// module is the DB-writing core, with no Next.js dependency (no revalidatePath)
// so it can be exercised directly in tests, same convention as lib/attempts.ts.

export const NOTE_TYPES = ["takeaway", "clue", "mistake", "template", "edge-case", "interview", "quick"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  takeaway: "My takeaway",
  clue: "Pattern clue",
  mistake: "Mistake",
  template: "Template",
  "edge-case": "Edge case",
  interview: "Interview explanation",
  quick: "Quick note",
};

export type NoteScope = { problemId?: number | null; pattern?: string | null; topicKey?: string | null };

export async function createNote(scope: NoteScope, type: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  return prisma.userNote.create({
    data: {
      type: NOTE_TYPES.includes(type as NoteType) ? type : "quick",
      content: trimmed,
      problemId: scope.problemId ?? null,
      pattern: scope.pattern ?? null,
      topicKey: scope.topicKey ?? null,
    },
  });
}

export async function updateNote(id: number, content: string, type?: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  return prisma.userNote.update({
    where: { id },
    data: { content: trimmed, ...(type && NOTE_TYPES.includes(type as NoteType) ? { type } : {}) },
  });
}

export async function deleteNote(id: number) {
  await prisma.userNote.delete({ where: { id } });
}

export async function getNotesFor(scope: NoteScope) {
  return prisma.userNote.findMany({
    where: {
      problemId: scope.problemId ?? undefined,
      pattern: scope.pattern ?? undefined,
      topicKey: scope.topicKey ?? undefined,
    },
    orderBy: { createdAt: "desc" },
  });
}

// §22: the data model supports search now, without a heavy search UI yet — a
// plain case-insensitive substring match is enough for a personal note set of
// this size (SQLite's LIKE is already case-insensitive for ASCII).
export async function searchNotes(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return prisma.userNote.findMany({
    where: { content: { contains: trimmed } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
