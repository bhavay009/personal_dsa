import { getApplications } from "@/lib/db";
import { ApplicationForm } from "./ApplicationForm";
import { ApplicationRow } from "./ApplicationRow";

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
          <ApplicationRow key={a.id} id={a.id} company={a.company} role={a.role} url={a.url} stage={a.stage} referral={a.referral} />
        ))}
      </div>
    </div>
  );
}
