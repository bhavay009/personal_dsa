import Link from "next/link";
import { getCurriculumOverview } from "@/lib/curriculum";
import { Panel, SectionLabel, StatusBadge } from "@/components/ui";
import type { TopicStatus } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

// §8: the DSA Roadmap — stages of topics, ✓/●/○ markers, current topic obvious,
// completed topics link through to their evidence rather than just a checkmark.

const MARKER: Record<TopicStatus, string> = {
  MASTERED: "✓",
  READY: "●",
  STRONG: "●",
  DEVELOPING: "●",
  LEARNING: "●",
  LOCKED: "○",
};

const STATUS_TONE: Record<TopicStatus, "success" | "warning" | "neutral" | "accent"> = {
  MASTERED: "success",
  READY: "accent",
  STRONG: "accent",
  DEVELOPING: "warning",
  LEARNING: "neutral",
  LOCKED: "neutral",
};

const STATUS_LABEL: Record<TopicStatus, string> = {
  MASTERED: "Mastered",
  READY: "Ready to advance",
  STRONG: "Strong",
  DEVELOPING: "Developing",
  LEARNING: "Not started",
  LOCKED: "Locked",
};

export default async function RoadmapPage() {
  const topics = await getCurriculumOverview();
  const stages = [...new Set(topics.map((t) => t.stage))];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div>
        <p className="text-sm text-muted">Your DSA journey</p>
        <h1 className="mt-1 text-xl font-semibold">DSA Roadmap</h1>
        <p className="mt-1 text-sm text-muted">
          One topic at a time. Old topics stay here forever — mastered doesn&apos;t mean forgotten.
        </p>
      </div>

      {stages.map((stage) => (
        <div key={stage}>
          <SectionLabel>{stage}</SectionLabel>
          <div className="mt-2 flex flex-col gap-2">
            {topics
              .filter((t) => t.stage === stage)
              .map((t) => (
                <Link key={t.key} href={t.status === "LOCKED" ? "#" : `/roadmap/${encodeURIComponent(t.key)}`}>
                  <Panel
                    className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-3 transition-colors ${
                      t.status === "LOCKED" ? "opacity-50" : "hover:border-border-strong"
                    } ${t.status !== "LOCKED" && t.status !== "MASTERED" ? "border-border-strong" : ""}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-4 shrink-0 text-center text-sm">{MARKER[t.status]}</span>
                      <span className="min-w-0 truncate text-sm font-medium">{t.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* "Mastered" implies the readiness gate was actually satisfied —
                          a manually-advanced topic says "Advanced" instead, so it's
                          never confused with having passed the gate (§ terminology
                          refinement). Only this one label changes; every other
                          status keeps its existing wording. */}
                      <StatusBadge tone={STATUS_TONE[t.status]}>
                        {t.status === "MASTERED" && t.overrideAdvanced ? "Advanced" : STATUS_LABEL[t.status]}
                      </StatusBadge>
                      {t.status === "MASTERED" && t.overrideAdvanced && <StatusBadge tone="warning">Override</StatusBadge>}
                      {t.reviewDue && <StatusBadge tone="accent">↻ Review due</StatusBadge>}
                    </div>
                  </Panel>
                </Link>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
