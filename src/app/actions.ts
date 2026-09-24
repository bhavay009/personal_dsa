"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import {
  compareJobDescription,
  computeSm2Update,
  outcomeToQuality,
  prisma,
  searchDocuments,
  type Outcome,
  PATTERNS,
} from "@/lib/db";
import { getSmartPlan } from "@/lib/insights";

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

export async function updateProblem(
  id: number,
  input: { title: string; url: string | null; pattern: string; difficulty: string },
) {
  await prisma.problem.update({
    where: { id },
    data: { title: input.title, url: input.url, pattern: input.pattern, difficulty: input.difficulty },
  });
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

export async function updateExam(id: number, input: { name: string; date: string }) {
  await prisma.exam.update({ where: { id }, data: { name: input.name, date: new Date(input.date) } });
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

async function extractPdfText(bytes: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    await parser.destroy();
    return result.text.slice(0, 200_000); // cap — this is a search index, not an archive
  } catch {
    return null; // scanned/image-only PDFs, or a parse failure — search just won't find this one
  }
}

export async function uploadDocument(formData: FormData, docType: "Notes" | "PYQ" | "Resume" = "Notes") {
  const file = formData.get("file");
  const folder = String(formData.get("folder") || "General").trim() || "General";
  if (!(file instanceof File) || file.size === 0) return;

  await mkdir(STORAGE_DIR, { recursive: true });
  const ext = path.extname(file.name) || ".pdf";
  const storedName = `${randomUUID()}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(STORAGE_DIR, storedName), bytes);

  const extractedText = await extractPdfText(bytes);

  await prisma.document.create({
    data: {
      filename: storedName,
      originalName: file.name,
      folder,
      sizeBytes: file.size,
      docType,
      extractedText,
    },
  });

  revalidatePath("/library");
  revalidatePath("/resume");
  revalidatePath("/");
}

export async function uploadResume(formData: FormData) {
  await uploadDocument(formData, "Resume");
}

export async function uploadPyq(formData: FormData) {
  await uploadDocument(formData, "PYQ");
}

export async function deleteDocument(id: number) {
  const doc = await prisma.document.delete({ where: { id } });
  await unlink(path.join(STORAGE_DIR, doc.filename)).catch(() => {});
  revalidatePath("/library");
  revalidatePath("/resume");
  revalidatePath("/");
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

// ---------- College: Subjects / Topics / Assignments ----------

export async function createSubject(input: { name: string; semester: string | null }) {
  await prisma.subject.create({ data: { name: input.name, semester: input.semester } });
  revalidatePath("/college");
}

export async function updateSubject(id: number, input: { name: string; semester: string | null }) {
  await prisma.subject.update({ where: { id }, data: { name: input.name, semester: input.semester } });
  revalidatePath("/college");
  revalidatePath(`/college/${id}`);
}

export async function deleteSubject(id: number) {
  await prisma.subject.delete({ where: { id } });
  revalidatePath("/college");
}

export async function createTopic(subjectId: number, name: string) {
  await prisma.topic.create({ data: { subjectId, name } });
  revalidatePath("/college");
}

export async function updateTopicName(id: number, name: string) {
  await prisma.topic.update({ where: { id }, data: { name } });
  revalidatePath("/college");
}

export async function updateTopicConfidence(id: number, confidence: number) {
  await prisma.topic.update({ where: { id }, data: { confidence, lastRevised: new Date() } });
  revalidatePath("/college");
  revalidatePath("/");
}

export async function deleteTopic(id: number) {
  await prisma.topic.delete({ where: { id } });
  revalidatePath("/college");
}

export async function createAssignment(input: {
  subjectId: number;
  title: string;
  deadline: string;
  priority: string;
  estimateMin: number | null;
}) {
  await prisma.assignment.create({
    data: {
      subjectId: input.subjectId,
      title: input.title,
      deadline: new Date(input.deadline),
      priority: input.priority,
      estimateMin: input.estimateMin,
    },
  });
  revalidatePath("/college");
  revalidatePath("/");
}

export async function updateAssignment(
  id: number,
  input: { title: string; deadline: string; priority: string; estimateMin: number | null },
) {
  await prisma.assignment.update({
    where: { id },
    data: { title: input.title, deadline: new Date(input.deadline), priority: input.priority, estimateMin: input.estimateMin },
  });
  revalidatePath("/college");
  revalidatePath("/");
}

export async function toggleAssignment(id: number, done: boolean) {
  await prisma.assignment.update({ where: { id }, data: { status: done ? "Done" : "Pending" } });
  revalidatePath("/college");
  revalidatePath("/");
}

export async function deleteAssignment(id: number) {
  await prisma.assignment.delete({ where: { id } });
  revalidatePath("/college");
}

// ---------- Skills ----------

export async function createSkill(input: { name: string; category: string }) {
  await prisma.skill.upsert({
    where: { name: input.name },
    create: { name: input.name, category: input.category },
    update: {},
  });
  revalidatePath("/skills");
}

export async function updateSkill(id: number, input: { name: string; category: string }) {
  await prisma.skill.update({ where: { id }, data: { name: input.name, category: input.category } });
  revalidatePath("/skills");
}

export async function updateSkillStage(id: number, stage: "learned" | "practiced" | "built" | "explained" | "interviewReady", value: boolean) {
  await prisma.skill.update({ where: { id }, data: { [stage]: value } });
  revalidatePath("/skills");
  revalidatePath("/insights");
}

export async function deleteSkill(id: number) {
  await prisma.skill.delete({ where: { id } });
  revalidatePath("/skills");
}

// ---------- Projects ----------

export async function createProject(input: { name: string; description: string | null; techStack: string | null }) {
  const project = await prisma.project.create({
    data: { name: input.name, description: input.description, techStack: input.techStack },
  });
  revalidatePath("/projects");
  return project.id;
}

export async function updateProjectMeta(
  id: number,
  input: { name: string; description: string | null; techStack: string | null },
) {
  await prisma.project.update({
    where: { id },
    data: { name: input.name, description: input.description, techStack: input.techStack },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function updateProject(
  id: number,
  input: { architecture: string; challenges: string; decisions: string; githubUrl: string; liveUrl: string },
) {
  await prisma.project.update({
    where: { id },
    data: {
      architecture: input.architecture || null,
      challenges: input.challenges || null,
      decisions: input.decisions || null,
      githubUrl: input.githubUrl || null,
      liveUrl: input.liveUrl || null,
    },
  });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/insights");
}

export async function deleteProject(id: number) {
  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
}

export async function addProjectQuestion(projectId: number, input: { difficulty: string; question: string }) {
  await prisma.interviewQuestion.create({
    data: { category: "Project", projectId, difficulty: input.difficulty, question: input.question },
  });
  revalidatePath(`/projects/${projectId}`);
}

// ---------- Interview prep ----------

export async function createInterviewQuestion(input: { category: string; difficulty: string; question: string }) {
  await prisma.interviewQuestion.create({ data: input });
  revalidatePath("/interview");
}

export async function deleteInterviewQuestion(id: number) {
  await prisma.interviewQuestion.delete({ where: { id } });
  revalidatePath("/interview");
}

export async function logInterviewSession(input: {
  mode: string;
  projectId: number | null;
  totalQ: number;
  correctQ: number;
  notes: string | null;
}) {
  await prisma.interviewSession.create({ data: input });
  revalidatePath("/interview");
  revalidatePath("/insights");
}

// ---------- Applications ----------

export async function createApplication(input: { company: string; role: string; url: string | null }) {
  await prisma.application.create({ data: { company: input.company, role: input.role, url: input.url } });
  revalidatePath("/applications");
  revalidatePath("/insights");
}

export async function updateApplication(id: number, input: { company: string; role: string; url: string | null }) {
  await prisma.application.update({ where: { id }, data: { company: input.company, role: input.role, url: input.url } });
  revalidatePath("/applications");
}

export async function updateApplicationStage(id: number, stage: string) {
  await prisma.application.update({
    where: { id },
    data: { stage, appliedDate: stage === "Applied" ? new Date() : undefined },
  });
  revalidatePath("/applications");
  revalidatePath("/insights");
}

export async function deleteApplication(id: number) {
  await prisma.application.delete({ where: { id } });
  revalidatePath("/applications");
}

// ---------- Coach: adaptive session (§6, §7) ----------

export async function startTodaySession(goalMin: number) {
  const { composeSession } = await import("@/lib/session-engine");

  // One active plan at a time — starting a new session closes the old one
  // rather than silently accumulating half-finished days.
  await prisma.sessionPlan.updateMany({ where: { status: "Active" }, data: { status: "Completed" } });

  const drafts = await composeSession(goalMin);
  const plan = await prisma.sessionPlan.create({
    data: {
      goalMin,
      blocks: {
        create: drafts.map((b, i) => ({
          position: i,
          kind: b.kind,
          minutes: b.minutes,
          pattern: b.pattern,
          problemId: b.problemId,
          rationale: b.rationale,
        })),
      },
    },
  });

  revalidatePath("/today");
  revalidatePath("/");
  return plan.id;
}

export async function setBlockStatus(blockId: number, status: "Done" | "Skipped" | "Pending") {
  await prisma.sessionBlock.update({ where: { id: blockId }, data: { status } });
  revalidatePath("/today");
  revalidatePath("/");
}

export async function finishSession(planId: number) {
  await prisma.sessionPlan.update({ where: { id: planId }, data: { status: "Completed" } });
  revalidatePath("/today");
  revalidatePath("/");
}

// §11: recorded before the attempt, so recognition is scored independently of
// whether the problem was eventually solved.
export async function recordPatternPrediction(problemId: number, predicted: string) {
  const problem = await prisma.problem.findUniqueOrThrow({
    where: { id: problemId },
    select: { pattern: true },
  });
  await prisma.patternPrediction.create({
    data: { problemId, predicted, actual: problem.pattern, correct: predicted === problem.pattern },
  });
  revalidatePath("/today");
  revalidatePath("/mastery");
  return { correct: predicted === problem.pattern, actual: problem.pattern };
}

export async function recordHint(problemId: number, level: number, secondsBefore: number) {
  await prisma.hintEvent.create({ data: { problemId, level, secondsBefore } });
  revalidatePath("/mastery");
}

// ---------- Resume: JD comparison ----------

export async function compareResumeToJD(jdText: string) {
  const skills = await prisma.skill.findMany({ select: { name: true } });
  return compareJobDescription(jdText, skills.map((s) => s.name), [...PATTERNS]);
}

// ---------- Library: Ask My Notes ----------

export async function searchNotes(query: string) {
  return searchDocuments(query);
}

// ---------- Insights: smart planner ----------

export async function fetchSmartPlan(hoursAvailable: number, goal: string) {
  return getSmartPlan(hoursAvailable, goal);
}
