import Link from "next/link";
import { deleteProblem } from "@/app/actions";
import { AddProblemForm } from "./AddProblemForm";
import { LeetCodeImportForm } from "./LeetCodeImportForm";
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
            <div key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline">
                      {p.title}
                    </a>
                  ) : (
                    <span className="truncate font-medium">{p.title}</span>
                  )}
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-black/50 dark:text-white/50">
                  <span>{p.pattern}</span>
                  <span>·</span>
                  <span>{p.difficulty}</span>
                  {lastMistake && (
                    <>
                      <span>·</span>
                      <span className="text-amber-600">{lastMistake}</span>
                    </>
                  )}
                </div>
              </div>
              <form action={deleteProblem.bind(null, p.id)}>
                <button className="shrink-0 text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400">
                  Delete
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "Solved"
      ? "text-green-700 dark:text-green-400"
      : status === "Attempted"
        ? "text-amber-600"
        : "text-black/40 dark:text-white/40";
  return <span className={`text-[10px] font-medium uppercase tracking-wide ${color}`}>{status}</span>;
}
