import Link from "next/link";
import { getAllPatternKnowledge } from "@/lib/pattern-knowledge";
import { getPatternMastery } from "@/lib/mastery";
import { Panel, SectionLabel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

// §32: "MY DSA NOTEBOOK" — browsable pattern library. §6 Phase: start with the
// patterns already represented in the curriculum, not 200 invented ones.

export default async function PatternsIndexPage() {
  const [patterns, mastery] = await Promise.all([getAllPatternKnowledge(), getPatternMastery()]);
  const masteryByPattern = new Map(mastery.map((m) => [m.pattern, m]));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-sm text-muted">Your personal DSA notebook</p>
        <h1 className="mt-1 text-xl font-semibold">Pattern Library</h1>
        <p className="mt-1 text-sm text-muted">
          Not just what pattern a problem uses — when to recognize it, when not to, and what to remember.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {patterns.map((p) => {
          const m = masteryByPattern.get(p.key);
          return (
            <Link key={p.key} href={`/patterns/${encodeURIComponent(p.key)}`}>
              <Panel className="flex items-center justify-between gap-3 py-3 transition-colors hover:border-border-strong">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.key}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{p.whatItIs}</p>
                </div>
                {m && <StatusBadge tone={m.priority === "HIGH" ? "danger" : m.priority === "LOW" ? "success" : "neutral"}>{m.state}</StatusBadge>}
              </Panel>
            </Link>
          );
        })}
      </div>

      {patterns.length === 0 && <SectionLabel>No pattern knowledge seeded yet.</SectionLabel>}
    </div>
  );
}
