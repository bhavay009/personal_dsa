import { notFound } from "next/navigation";
import { getProjectDetail } from "@/lib/db";
import { ProjectDetailForm } from "../ProjectDetailForm";
import { ProjectHeader } from "../ProjectHeader";
import { ProjectInterviewer } from "../ProjectInterviewer";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectDetail(Number(id));
  if (!project) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <ProjectHeader id={project.id} name={project.name} description={project.description} techStack={project.techStack} />

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
