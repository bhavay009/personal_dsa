import Link from "next/link";
import { notFound } from "next/navigation";
import { getTopicPage, getNextTopic, type ReadinessDimension } from "@/lib/curriculum";
import { getNotesFor } from "@/lib/notes";
import { Panel, SectionLabel, StatusBadge } from "@/components/ui";
import { TopicGate } from "@/components/TopicGate";
import { MyNotesPanel } from "@/components/MyNotesPanel";
import { MISTAKE_TAGS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const DIMENSION_ORDER: { key: ReadinessDimension; label: string }[] = [
  { key: "concept", label: "Concept understanding" },
  { key: "recognition", label: "Pattern recognition" },
  { key: "implementation", label: "Independent implementation" },
  { key: "problemSolving", label: "Problem solving" },
  { key: "transfer", label: "Transfer" },
  { key: "speed", label: "Speed" },
  { key: "retention", label: "Retention" },
];

const SIGNAL_TONE = { strong: "success", developing: "warning", weak: "danger", "no data": "neutral" } as const;

export default async function TopicDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const topicKey = decodeURIComponent(key);
  const page = await getTopicPage(topicKey);
  if (!page) notFound();

  const { readiness } = page;
  const nextTopic = await getNextTopic(readiness.order);
  const notesRaw = await getNotesFor({ topicKey });
  const notes = notesRaw.map((n) => ({ id: n.id, type: n.type, content: n.content, createdAt: n.createdAt.toISOString() }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div>
        <Link href="/roadmap" className="text-xs text-muted hover:text-foreground hover:underline">
          ← Roadmap
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{readiness.name}</h1>
          {/* "Mastered" implies the readiness gate was actually satisfied — a
              manually-advanced topic says "Advanced" instead (§ terminology
              refinement). Every other status keeps its existing raw label. */}
          <StatusBadge tone={readiness.status === "MASTERED" ? "success" : readiness.status === "READY" ? "accent" : "neutral"}>
            {readiness.status === "MASTERED" && readiness.userOverrideAdvanced ? "Advanced" : readiness.status}
          </StatusBadge>
          {readiness.status === "MASTERED" && readiness.userOverrideAdvanced && <StatusBadge tone="warning">Manual override</StatusBadge>}
          {readiness.reviewDue && <StatusBadge tone="accent">↻ Review due</StatusBadge>}
        </div>
        <p className="mt-1 text-sm text-muted">{readiness.stage}</p>
      </div>

      <Panel>
        <SectionLabel>Recommendation</SectionLabel>
        <p className="mt-1 text-sm font-medium">{readiness.recommendation}</p>
      </Panel>

      {page.isCurrent && (
        <TopicGate
          topicKey={readiness.key}
          topicName={readiness.name}
          ready={readiness.status === "READY"}
          gaps={readiness.gaps}
          nextTopicName={nextTopic?.name ?? null}
        />
      )}

      <div>
        <SectionLabel>What you&apos;ll learn</SectionLabel>
        <Panel className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-foreground/80">{page.overview}</p>
          <p className="text-sm text-foreground/80">
            <span className="font-semibold">Why it matters: </span>
            {page.whyItMatters}
          </p>
          <BulletGroup title="Core concepts" items={page.coreConcepts} />
          <BulletGroup title="Key patterns" items={page.keyPatterns} />
          <BulletGroup title="Common mistakes" items={page.commonMistakes} />
          <BulletGroup title="Interview clues" items={page.interviewClues} />
        </Panel>
      </div>

      <div>
        <SectionLabel>Progress checklist</SectionLabel>
        <div className="mt-2 flex flex-col gap-2">
          {DIMENSION_ORDER.map((d) => {
            const s = readiness.dimensions[d.key];
            return (
              <Panel key={d.key} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{d.label}</span>
                <div className="flex items-center gap-2">
                  {s.label !== "no data" && <span className="text-xs text-muted">{s.pct}% / {s.evidence}</span>}
                  <StatusBadge tone={SIGNAL_TONE[s.label]}>{s.label}</StatusBadge>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Your performance</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Attempted" value={readiness.stats.problemsAttempted} />
          <Stat label="Independent solves" value={readiness.stats.independentSolves} />
          <Stat label="Avg time" value={readiness.stats.averageTimeMin != null ? `${readiness.stats.averageTimeMin}m` : "—"} />
          <Stat label="Hints / problem" value={readiness.stats.hintsPerProblem} />
        </div>
      </div>

      {readiness.recentMistakes.length > 0 && (
        <div>
          <SectionLabel>Recent mistakes</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {readiness.recentMistakes.map((tag, i) => (
              <StatusBadge key={`${tag}-${i}`} tone="warning">
                {MISTAKE_TAGS.find((t) => t.value === tag)?.label ?? tag}
              </StatusBadge>
            ))}
          </div>
        </div>
      )}

      <MyNotesPanel scope={{ topicKey }} notes={notes} defaultOpen={notes.length > 0} />
    </div>
  );
}

function BulletGroup({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-foreground/80">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel className="p-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Panel>
  );
}
