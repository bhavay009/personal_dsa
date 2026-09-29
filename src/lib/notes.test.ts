import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTempDb, pointAtTempDb } from "@/lib/test/temp-db";

// Integration tests against a real, throwaway SQLite database (never dev.db) —
// covers §40's note-CRUD checklist: create/edit/delete, scoped to a
// problem/pattern/topic independently.

let dbPath: string;
let testPrisma: PrismaClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ dbPath, testPrisma, teardown } = await setupTempDb());
}, 30_000);

afterAll(async () => {
  await teardown();
});

async function loadNotes() {
  pointAtTempDb(dbPath);
  return import("@/lib/notes");
}

describe("note CRUD", () => {
  it("creates, edits, and deletes a problem-scoped note", async () => {
    const { createNote, updateNote, deleteNote, getNotesFor } = await loadNotes();

    const problem = await testPrisma.problem.create({
      data: { title: "Note Target Problem", pattern: "Hashing", difficulty: "Easy", status: "Solved" },
    });

    const created = await createNote({ problemId: problem.id }, "takeaway", "Remember to check for duplicates.");
    expect(created).not.toBeNull();
    expect(created!.type).toBe("takeaway");

    let notes = await getNotesFor({ problemId: problem.id });
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toBe("Remember to check for duplicates.");

    await updateNote(created!.id, "Updated: check for duplicates AND overflow.");
    notes = await getNotesFor({ problemId: problem.id });
    expect(notes[0].content).toBe("Updated: check for duplicates AND overflow.");

    await deleteNote(created!.id);
    notes = await getNotesFor({ problemId: problem.id });
    expect(notes).toHaveLength(0);
  });

  it("scopes notes independently by problem, pattern, and topic", async () => {
    const { createNote, getNotesFor } = await loadNotes();

    const problem = await testPrisma.problem.create({
      data: { title: "Scoping Problem", pattern: "Binary Search", difficulty: "Medium", status: "Unsolved" },
    });

    await createNote({ problemId: problem.id }, "quick", "Problem-scoped note.");
    await createNote({ pattern: "Binary Search" }, "clue", "Pattern-scoped note.");
    await createNote({ topicKey: "Binary Search" }, "template", "Topic-scoped note.");

    expect(await getNotesFor({ problemId: problem.id })).toHaveLength(1);
    expect(await getNotesFor({ pattern: "Binary Search" })).toHaveLength(1);
    expect(await getNotesFor({ topicKey: "Binary Search" })).toHaveLength(1);
  });

  it("rejects an empty note rather than saving a blank row", async () => {
    const { createNote, getNotesFor } = await loadNotes();
    const result = await createNote({ pattern: "Greedy" }, "quick", "   ");
    expect(result).toBeNull();
    expect(await getNotesFor({ pattern: "Greedy" })).toHaveLength(0);
  });
});
