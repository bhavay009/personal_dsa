import Link from "next/link";
import { getHintDependency, getPatternMastery, getPredictionCrossTab, type MasteryState, type PatternMastery, type Signal } from "@/lib/mastery";
import { detectPatternConfusion } from "@/lib/pattern-knowledge";
import { EmptyState, Panel, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<MasteryState, string> = {
  UNKNOWN: "Not started",
  EXPOSED: "Seen, not yet recognized reliably",
  RECOGNIZED: "Recognizes the pattern",
  APPLIED: "Can apply it",
  RETAINED: "Retains it over time",
  TRANSFERRED: "Can transfer to new surfaces",
  INTERVIEW_READY: "Interview ready",
};

// What to train next, derived from which dimension is weakest — this is the same
// idea as the session engine's own routing, just phrased for a human reading the
// mastery page rather than composing a session block.
function nextTraining(m: PatternMastery): string {
  if (m.recognition.label === "weak") return "Pattern recall drills — name it before you solve it.";
  if (m.implementation.label === "weak") return "Algorithm reconstruction, then a careful re-solve.";
  if (m.retention.label === "weak") return "Spaced re-solve of problems you've already seen.";
  if (m.transfer.label === "weak") return "A transfer challenge — same technique, different surface.";
  if (m.speed.label === "weak") return "A timed blind test to build pace.";
  return "Keep going — no single weak dimension stands out yet.";
}

export default async function MasteryPage() {
  const [report, hintDependency, crossTab, confusions] = await Promise.all([
    getPatternMastery(),
    getHintDependency(),
    getPredictionCrossTab(),
    detectPatternConfusion(),
  ]);

  const strong = report.filter((m) => m.priority === "LOW");
  const developing = report.filter((m) => m.priority === "MEDIUM");
  const needsAttention = report.filter((m) => m.priority === "HIGH");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">What do I actually know?</h1>
        <p className="mt-1 text-sm text-muted">
          Every number here is a training signal with its evidence count attached — not a score. A dimension stays
          &ldquo;insufficient evidence&rdquo; until there are at least 3 observations behind it.
        </p>
      </div>

      {hintDependency.sample > 0 && (
        <Panel>
          <div className="text-2xl font-semibold">{hintDependency.pct}%</div>
          <div className="text-xs text-muted">
            of your last {hintDependency.sample} problems needed heavy help
            {hintDependency.pct >= 40 && " — the engine is scheduling no-hint blocks until this drops"}
          </div>
        </Panel>
      )}

      {crossTab.insight && (
        <Panel>
          <SectionLabel>Pattern recognition</SectionLabel>
          <p className="mt-1 text-sm">{crossTab.insight}</p>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
            <span>Predicted right, solved: {crossTab.correctSolved}</span>
            <span>Predicted right, failed: {crossTab.correctFailed}</span>
            <span>Predicted wrong, solved: {crossTab.incorrectSolved}</span>
            <span>Predicted wrong, failed: {crossTab.incorrectFailed}</span>
          </div>
        </Panel>
      )}

      {confusions.length > 0 && (
        <Panel>
          <SectionLabel>You often confuse these</SectionLabel>
          <div className="mt-2 flex flex-col gap-2">
            {confusions.map((c) => (
              <div key={`${c.patternA}-${c.patternB}`} className="flex items-center justify-between text-sm">
                <span>
                  {c.patternA} vs {c.patternB}
                </span>
                <span className="text-xs text-muted">{c.count} mix-ups</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Open either pattern&apos;s guide for a side-by-side comparison and a recognition quiz.</p>
        </Panel>
      )}

      {report.length === 0 && (
        <EmptyState
          title="Not enough data yet"
          description="Solve a few problems and the model starts filling in. We won't guess at mastery from nothing."
        />
      )}

      <PatternGroup title="Needs attention" patterns={needsAttention} tone="danger" />
      <PatternGroup title="Developing" patterns={developing} tone="warning" />
      <PatternGroup title="Strong" patterns={strong} tone="success" />

      <Link href="/today" className="self-start text-xs text-muted hover:text-foreground hover:underline">
        ← Back to today&apos;s session
      </Link>
    </div>
  );
}

function PatternGroup({ title, patterns, tone }: { title: string; patterns: PatternMastery[]; tone: "success" | "warning" | "danger" }) {
  if (patterns.length === 0) return null;
  const dot = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-2 flex flex-col gap-2">
        {patterns.map((m) => (
          <details key={m.pattern} className="group rounded-lg border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                <span className="text-sm font-medium">{m.pattern}</span>
              </span>
              <span className="text-xs text-muted">{STATE_LABEL[m.state]}</span>
            </summary>
            <div className="border-t border-border px-4 py-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
                <Dim label="Recognition" s={m.recognition} />
                <Dim label="Implementation" s={m.implementation} />
                <Dim label="Speed" s={m.speed} />
                <Dim label="Retention" s={m.retention} />
                <Dim label="Transfer" s={m.transfer} />
              </div>
              <p className="mt-3 text-xs text-muted">
                {m.solvedCount}/{m.problemCount} solved. {m.reason}
              </p>
              <div className="mt-3 rounded-md bg-surface-muted p-3">
                <SectionLabel>Next training</SectionLabel>
                <p className="mt-1 text-sm">{nextTraining(m)}</p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Dim({ label, s }: { label: string; s: Signal }) {
  const color =
    s.label === "strong"
      ? "text-success"
      : s.label === "developing"
        ? "text-warning"
        : s.label === "weak"
          ? "text-danger"
          : "text-muted";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-sm font-medium ${color}`}>
        {s.pct === null ? "insufficient evidence" : `${s.pct}%`}
        <span className="ml-1 text-[10px] font-normal text-muted">n={s.evidence}</span>
      </div>
    </div>
  );
}
