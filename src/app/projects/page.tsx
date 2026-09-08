import Link from "next/link";
import { getProjects } from "@/lib/db";
import { AddProjectForm } from "./AddProjectForm";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Projects</h1>
      <AddProjectForm />

      <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
        {projects.length === 0 && <p className="py-6 text-sm text-black/50 dark:text-white/50">No projects yet.</p>}
        {projects.map((p) => {
          const complete = [p.architecture, p.challenges, p.decisions].filter(Boolean).length;
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
              <div className="min-w-0">
                <div className="font-medium">{p.name}</div>
                {p.description && <div className="truncate text-xs text-black/50 dark:text-white/50">{p.description}</div>}
              </div>
              <span className="shrink-0 text-xs text-black/40 dark:text-white/40">{complete}/3 documented</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
