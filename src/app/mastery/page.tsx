import Link from "next/link";
import { getHintDependency, getPatternMastery, type Signal } from "@/lib/mastery";

export const dynamic = "force-dynamic";

const STATE_ORDER = [
  "UNKNOWN",
  "EXPOSED",
  "RECOGNIZED",
  "APPLIED",
  "RETAINED",
  "TRANSFERRED",
  "INTERVIEW_READY",
];

export default async function MasteryPage() {
  const [report, hintDependency] = await Promise.all([getPatternMastery(), getHintDependency()]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Pattern mastery</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Every number here is a training signal with its evidence count attached — not a score. A dimension
          stays &ldquo;no data&rdquo; until there are at least 3 observations behind it.
        </p>
      </div>

      {hintDependency.sample > 0 && (
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <div className="text-2xl font-semibold">{hintDependency.pct}%</div>
          <div className="text-xs text-black/50 dark:text-white/50">
            of your last {hintDependency.sample} problems needed a level-5+ hint
            {hintDependency.pct >= 40 && " — the engine is scheduling no-hint blocks until this drops"}
          </div>
        </div>
      )}

      {report.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">
          No patterns tracked yet. Log some problems and the model starts filling in.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {report.map((m) => (
          <div key={m.pattern} className="rounded-lg border border-black/10 p-4 dark:border-white/15">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{m.pattern}</div>
                <div className="text-xs text-black/40 dark:text-white/40">
                  {m.solvedCount}/{m.problemCount} solved · step {STATE_ORDER.indexOf(m.state) + 1} of{" "}
                  {STATE_ORDER.length}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-semibold uppercase tracking-wide">{m.state.replace("_", " ")}</div>
                <div
                  className={`text-[10px] font-medium uppercase ${
                    m.priority === "HIGH"
                      ? "text-red-600"
                      : m.priority === "MEDIUM"
                        ? "text-amber-600"
                        : "text-black/40 dark:text-white/40"
                  }`}
                >
                  {m.priority} priority
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
              <Dim label="Recognition" s={m.recognition} />
              <Dim label="Implementation" s={m.implementation} />
              <Dim label="Speed" s={m.speed} />
              <Dim label="Retention" s={m.retention} />
              <Dim label="Transfer" s={m.transfer} />
            </div>

            <p className="mt-3 text-xs text-black/60 dark:text-white/60">{m.reason}</p>
          </div>
        ))}
      </div>

      <Link
        href="/today"
        className="self-start text-xs text-black/40 hover:text-black/70 hover:underline dark:text-white/40 dark:hover:text-white/70"
      >
        ← Back to today&apos;s session
      </Link>
    </div>
  );
}

function Dim({ label, s }: { label: string; s: Signal }) {
  const color =
    s.label === "strong"
      ? "text-green-700 dark:text-green-400"
      : s.label === "medium"
        ? "text-amber-600"
        : s.label === "weak"
          ? "text-red-600"
          : "text-black/30 dark:text-white/30";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-black/40 dark:text-white/40">{label}</div>
      <div className={`text-sm font-medium ${color}`}>
        {s.pct === null ? "no data" : `${s.pct}%`}
        <span className="ml-1 text-[10px] font-normal text-black/30 dark:text-white/30">n={s.evidence}</span>
      </div>
    </div>
  );
}
