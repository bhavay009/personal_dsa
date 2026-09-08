import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProject } from "@/app/actions";
import { getProjectDetail } from "@/lib/db";
import { ProjectDetailForm } from "../ProjectDetailForm";
import { ProjectInterviewer } from "../ProjectInterviewer";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectDetail(Number(id));
  if (!project) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/projects" className="text-xs text-black/40 hover:underline dark:text-white/40">
            ← Projects
          </Link>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          {project.description && <p className="text-sm text-black/60 dark:text-white/60">{project.description}</p>}
          {project.techStack && <p className="text-xs text-black/40 dark:text-white/40">{project.techStack}</p>}
        </div>
        <form action={deleteProject.bind(null, project.id)}>
          <button className="shrink-0 text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400">
            Delete project
          </button>
        </form>
      </div>

      <ProjectDetailForm
        projectId={project.id}
        architecture={project.architecture ?? ""}
        challenges={project.challenges ?? ""}
        decisions={project.decisions ?? ""}
        githubUrl={project.githubUrl ?? ""}
        liveUrl={project.liveUrl ?? ""}
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Interview me about this project</h2>
        <ProjectInterviewer projectId={project.id} customQuestions={project.questions} />
      </div>
    </div>
  );
}
