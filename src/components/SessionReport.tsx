import type { SessionReport } from "@/lib/session-engine";
import { MISTAKE_TAGS } from "@/lib/constants";
import { Panel, SectionLabel, StatusBadge } from "@/components/ui";

export function SessionReportView({ report }: { report: SessionReport }) {
  const mistakeLabel = (tag: string) => MISTAKE_TAGS.find((t) => t.value === tag)?.label ?? tag;

  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {report.mode === "OA" ? "Mock OA report" : report.mode === "Blind" ? "Blind session complete" : "Session report"}
        </h2>
        <span className="text-xs text-muted">
          Completed {report.solvedCount}/{report.totalBlocks}
        </span>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <SectionLabel>Results</SectionLabel>
        {report.items.map((item) => (
          <div key={item.blockId} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <span className="truncate">{item.problemTitle ?? "—"}</span>
              {item.pattern && <span className="ml-2 text-xs text-muted">{item.pattern}</span>}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs">
              {item.outcome ? (
                <StatusBadge tone={item.outcome === "Solved" ? "success" : "danger"}>{item.outcome}</StatusBadge>
              ) : (
                <StatusBadge>Not logged</StatusBadge>
              )}
              {item.timeTakenMin != null && (
                <span className="text-muted">
                  {item.timeTakenMin}m{item.targetMinutes != null && ` / ${item.targetMinutes}m target`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {report.patternCoverage.length > 0 && (
        <div className="border-t border-border pt-3">
          <SectionLabel>Pattern coverage</SectionLabel>
          <p className="mt-1 text-sm">{report.patternCoverage.join(", ")}</p>
        </div>
      )}

      {Object.keys(report.mistakeBreakdown).length > 0 && (
        <div className="border-t border-border pt-3">
          <SectionLabel>Mistakes</SectionLabel>
          <p className="mt-1 text-sm">
            {Object.entries(report.mistakeBreakdown).map(([tag, n]) => `${mistakeLabel(tag)} (${n})`).join(", ")}
          </p>
        </div>
      )}

      <p className="text-[11px] text-muted">{report.note}</p>
    </Panel>
  );
}
