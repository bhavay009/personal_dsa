"use server";

import { revalidatePath } from "next/cache";
import { computeNextRevision, getPriorStreak, prisma, type Outcome } from "@/lib/db";

export type AttemptInput = {
  outcome: Outcome | null;
  mistakeTag: string | null;
  timeTakenMin: number | null;
};

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
    const { nextRevision } = computeNextRevision(0, input.attempt.outcome, now);
    await prisma.attempt.create({
      data: {
        problemId: problem.id,
        date: now,
        outcome: input.attempt.outcome,
        mistakeTag: input.attempt.mistakeTag,
        timeTakenMin: input.attempt.timeTakenMin,
        nextRevision,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/problems");
  revalidatePath("/revise");
}

export async function logAttempt(problemId: number, input: AttemptInput) {
  if (!input.outcome) return;
  const now = new Date();
  const priorStreak = await getPriorStreak(problemId);
  const { nextRevision } = computeNextRevision(priorStreak, input.outcome, now);

  await prisma.attempt.create({
    data: {
      problemId,
      date: now,
      outcome: input.outcome,
      mistakeTag: input.mistakeTag,
      timeTakenMin: input.timeTakenMin,
      nextRevision,
    },
  });

  await prisma.problem.update({
    where: { id: problemId },
    data: { status: input.outcome === "Solved" ? "Solved" : "Attempted" },
  });

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
