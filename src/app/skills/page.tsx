import { getSkills } from "@/lib/db";
import { AddSkillForm } from "./AddSkillForm";
import { SkillRow } from "./SkillRow";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const byCategory = await getSkills();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Skills</h1>
        <p className="mt-1 text-xs text-black/40 dark:text-white/40">
          L = Learned · P = Practiced · B = Built · E = Explained · IR = Interview Ready
        </p>
      </div>
      <AddSkillForm />

      {byCategory.size === 0 && <p className="text-sm text-black/50 dark:text-white/50">No skills tracked yet.</p>}

      {[...byCategory.entries()].map(([category, skills]) => (
        <div key={category} className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">{category}</h2>
          <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
            {skills.map((s) => (
              <SkillRow
                key={s.id}
                id={s.id}
                name={s.name}
                category={s.category}
                stages={{
                  learned: s.learned,
                  practiced: s.practiced,
                  built: s.built,
                  explained: s.explained,
                  interviewReady: s.interviewReady,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
