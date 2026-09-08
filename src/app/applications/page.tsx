import { deleteApplication } from "@/app/actions";
import { getApplications } from "@/lib/db";
import { ApplicationForm } from "./ApplicationForm";
import { StageSelect } from "./StageSelect";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const applications = await getApplications();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Applications</h1>
      <ApplicationForm />

      <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
        {applications.length === 0 && (
          <p className="py-6 text-sm text-black/50 dark:text-white/50">No applications tracked yet.</p>
        )}
        {applications.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="font-medium">
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {a.company}
                  </a>
                ) : (
                  a.company
                )}
              </div>
              <div className="text-xs text-black/50 dark:text-white/50">
                {a.role}
                {a.referral && " · referral"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StageSelect id={a.id} stage={a.stage} />
              <form action={deleteApplication.bind(null, a.id)}>
                <button className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
