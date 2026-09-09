import Link from "next/link";
import { AddProblemForm } from "./AddProblemForm";
import { LeetCodeImportForm } from "./LeetCodeImportForm";
import { ProblemRow } from "./ProblemRow";
import { prisma } from "@/lib/db";

const FILTERS = ["All", "Solved", "Unsolved", "Attempted", "Mistakes", "Easy", "Medium", "Hard"] as const;
type Filter = (typeof FILTERS)[number];

async function getFilteredProblems(filter: Filter) {
  if (filter === "All") {
    return prisma.problem.findMany({ orderBy: { createdAt: "desc" }, include: { attempts: true } });
  }
  if (["Solved", "Unsolved", "Attempted"].includes(filter)) {
    return prisma.problem.findMany({
      where: { status: filter },
      orderBy: { createdAt: "desc" },
      include: { attempts: true },
    });
  }
  if (["Easy", "Medium", "Hard"].includes(filter)) {
    return prisma.problem.findMany({
      where: { difficulty: filter },
      orderBy: { createdAt: "desc" },
      include: { attempts: true },
    });
  }
  // Mistakes: problems with at least one tagged mistake
  return prisma.problem.findMany({
    where: { attempts: { some: { mistakeTag: { not: null } } } },
    orderBy: { createdAt: "desc" },
    include: { attempts: true },
  });
}

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(rawFilter ?? "") ? (rawFilter as Filter) : "All";
  const problems = await getFilteredProblems(filter);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Problems</h1>

      <AddProblemForm />
      <LeetCodeImportForm />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "All" ? "/problems" : `/problems?filter=${f}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === f
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/20 text-black/70 dark:border-white/25 dark:text-white/70"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
        {problems.length === 0 && (
          <p className="py-6 text-sm text-black/50 dark:text-white/50">No problems here yet.</p>
        )}
        {problems.map((p) => {
          const lastMistake = [...p.attempts].reverse().find((a) => a.mistakeTag)?.mistakeTag;
          return (
            <ProblemRow
              key={p.id}
              id={p.id}
              title={p.title}
              url={p.url}
              pattern={p.pattern}
              difficulty={p.difficulty}
              status={p.status}
              lastMistake={lastMistake}
            />
          );
        })}
      </div>
    </div>
  );
}
