"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import {
  computeSm2Update,
  outcomeToQuality,
  prisma,
  type Outcome,
  PATTERNS,
} from "@/lib/db";

export type AttemptInput = {
  outcome: Outcome | null;
  mistakeTag: string | null;
  timeTakenMin: number | null;
};

const DEFAULT_SM2 = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

export async function createProblem(input: {
  title: string;
  url: string | null;
  pattern: string;
  difficulty: string;
  attempt: AttemptInput;
}) {
  const status = !input.attempt.outcome ? "Unsolved" : input.attempt.outcome === "Solved" ? "Solved" : "Attempted";

  const problem = await prisma.problem.create({
    data: {
      title: input.title,
      url: input.url || null,
      pattern: input.pattern,
      difficulty: input.difficulty,
      status,
    },
  });

  if (input.attempt.outcome) {
    const now = new Date();
    const quality = outcomeToQuality(input.attempt.outcome, input.attempt.mistakeTag);
    const sm2 = computeSm2Update(DEFAULT_SM2, quality, now);
    await Promise.all([
      prisma.attempt.create({
        data: {
          problemId: problem.id,
          date: now,
          outcome: input.attempt.outcome,
          mistakeTag: input.attempt.mistakeTag,
          timeTakenMin: input.attempt.timeTakenMin,
          nextRevision: sm2.nextRevision,
        },
      }),
      prisma.problem.update({
        where: { id: problem.id },
        data: { easeFactor: sm2.easeFactor, intervalDays: sm2.intervalDays, repetitions: sm2.repetitions },
      }),
    ]);
  }

  revalidatePath("/");
  revalidatePath("/problems");
  revalidatePath("/revise");
}

export async function logAttempt(problemId: number, input: AttemptInput) {
  if (!input.outcome) return;
  const now = new Date();

  const problem = await prisma.problem.findUniqueOrThrow({
    where: { id: problemId },
    select: { easeFactor: true, intervalDays: true, repetitions: true },
  });

  const quality = outcomeToQuality(input.outcome, input.mistakeTag);
  const sm2 = computeSm2Update(problem, quality, now);

  await Promise.all([
    prisma.attempt.create({
      data: {
        problemId,
        date: now,
        outcome: input.outcome,
        mistakeTag: input.mistakeTag,
        timeTakenMin: input.timeTakenMin,
        nextRevision: sm2.nextRevision,
      },
    }),
    prisma.problem.update({
      where: { id: problemId },
      data: {
        status: input.outcome === "Solved" ? "Solved" : "Attempted",
        easeFactor: sm2.easeFactor,
        intervalDays: sm2.intervalDays,
        repetitions: sm2.repetitions,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/problems");
  revalidatePath("/revise");
}

export async function deleteProblem(id: number) {
  await prisma.problem.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/problems");
  revalidatePath("/revise");
}

// ---------- Exams ----------

export async function createExam(input: { name: string; date: string }) {
  await prisma.exam.create({ data: { name: input.name, date: new Date(input.date) } });
  revalidatePath("/");
  revalidatePath("/exams");
}

export async function deleteExam(id: number) {
  await prisma.exam.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/exams");
}

// ---------- PDF library ----------

const STORAGE_DIR = path.join(process.cwd(), "storage", "pdfs");

export async function uploadDocument(formData: FormData) {
  const file = formData.get("file");
  const folder = String(formData.get("folder") || "General").trim() || "General";
  if (!(file instanceof File) || file.size === 0) return;

  await mkdir(STORAGE_DIR, { recursive: true });
  const ext = path.extname(file.name) || ".pdf";
  const storedName = `${randomUUID()}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(STORAGE_DIR, storedName), bytes);

  await prisma.document.create({
    data: {
      filename: storedName,
      originalName: file.name,
      folder,
      sizeBytes: file.size,
    },
  });

  revalidatePath("/library");
}

export async function deleteDocument(id: number) {
  const doc = await prisma.document.delete({ where: { id } });
  await unlink(path.join(STORAGE_DIR, doc.filename)).catch(() => {});
  revalidatePath("/library");
}

// ---------- LeetCode import ----------

type LeetCodeImportResult = { imported: number; skipped: number; error: string | null };

const LEETCODE_TO_PATTERN: Record<string, (typeof PATTERNS)[number]> = {
  Array: "Arrays",
  String: "Strings",
  "Hash Table": "Hashing",
  "Two Pointers": "Two Pointers",
  "Sliding Window": "Sliding Window",
  "Prefix Sum": "Prefix Sum",
  "Binary Search": "Binary Search",
  "Linked List": "Linked List",
  Stack: "Stack",
  Queue: "Queue",
  "Monotonic Stack": "Monotonic Stack",
  Tree: "Trees",
  "Binary Tree": "Trees",
  "Binary Search Tree": "BST",
  Heap: "Heap",
  "Heap (Priority Queue)": "Heap",
  "Breadth-First Search": "BFS",
  "Depth-First Search": "DFS",
  Graph: "Graphs",
  "Topological Sort": "Topological Sort",
  Greedy: "Greedy",
  Backtracking: "Backtracking",
  "Dynamic Programming": "Dynamic Programming",
};

async function leetcodeGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`LeetCode responded ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? "LeetCode GraphQL error");
  return json.data as T;
}

export async function importFromLeetCode(username: string): Promise<LeetCodeImportResult> {
  const trimmed = username.trim();
  if (!trimmed) return { imported: 0, skipped: 0, error: "Enter a LeetCode username." };

  try {
    const data = await leetcodeGraphql<{
      recentAcSubmissionList: { title: string; titleSlug: string; timestamp: string }[];
    }>(
      `query recentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          title
          titleSlug
          timestamp
        }
      }`,
      { username: trimmed, limit: 20 },
    );

    const submissions = data.recentAcSubmissionList ?? [];
    if (submissions.length === 0) {
      return { imported: 0, skipped: 0, error: "No recent accepted submissions found (or username is wrong)." };
    }

    const existingTitles = new Set(
      (await prisma.problem.findMany({ select: { title: true } })).map((p) => p.title.toLowerCase()),
    );

    let imported = 0;
    let skipped = 0;

    // De-dup within this batch too — recentAcSubmissionList can list the same problem
    // multiple times if solved more than once.
    const seenThisRun = new Set<string>();

    for (const sub of submissions) {
      const key = sub.title.toLowerCase();
      if (existingTitles.has(key) || seenThisRun.has(key)) {
        skipped++;
        continue;
      }
      seenThisRun.add(key);

      let difficulty = "Medium";
      let pattern: (typeof PATTERNS)[number] = "Other";
      try {
        const q = await leetcodeGraphql<{
          question: { difficulty: string; topicTags: { name: string }[] } | null;
        }>(
          `query questionData($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              difficulty
              topicTags { name }
            }
          }`,
          { titleSlug: sub.titleSlug },
        );
        if (q.question) {
          difficulty = q.question.difficulty;
          const match = q.question.topicTags.map((t) => LEETCODE_TO_PATTERN[t.name]).find(Boolean);
          if (match) pattern = match;
        }
      } catch {
        // Best effort — fall back to Medium / Other if the per-question lookup fails.
      }

      const solvedAt = new Date(Number(sub.timestamp) * 1000);
      const sm2 = computeSm2Update(DEFAULT_SM2, 5, solvedAt);

      const problem = await prisma.problem.create({
        data: {
          title: sub.title,
          url: `https://leetcode.com/problems/${sub.titleSlug}/`,
          pattern,
          difficulty,
          status: "Solved",
          easeFactor: sm2.easeFactor,
          intervalDays: sm2.intervalDays,
          repetitions: sm2.repetitions,
        },
      });
      await prisma.attempt.create({
        data: {
          problemId: problem.id,
          date: solvedAt,
          outcome: "Solved",
          nextRevision: sm2.nextRevision,
        },
      });
      imported++;
    }

    revalidatePath("/");
    revalidatePath("/problems");
    revalidatePath("/revise");
    return { imported, skipped, error: null };
  } catch (err) {
    return {
      imported: 0,
      skipped: 0,
      error: `Couldn't reach LeetCode (${err instanceof Error ? err.message : "unknown error"}). Their unofficial API can change or block requests without notice — add the problem manually if this keeps failing.`,
    };
  }
}
