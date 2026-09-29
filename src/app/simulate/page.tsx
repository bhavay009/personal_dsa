import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel, SectionLabel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

// §22: SIMULATE — one clean entry point for the two interview-condition modes
// (no hints, no pattern labels). The modes themselves stay at /blind and /oa;
// this page is just the grouping the nav item points to.

export default async function SimulatePage() {
  const [blindPlan, oaPlan] = await Promise.all([
    prisma.sessionPlan.findFirst({ where: { status: "Active", mode: "Blind" } }),
    prisma.sessionPlan.findFirst({ where: { status: "Active", mode: "OA" } }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-sm text-muted">Interview simulation</p>
        <h1 className="mt-1 text-xl font-semibold">Simulate</h1>
        <p className="mt-1 text-sm text-muted">
          Interview conditions: no hints, no pattern labels, on the clock. Use these once a pattern feels solid, not
          while you&apos;re still learning it.
        </p>
      </div>

      <Link href="/blind">
        <Panel className="flex items-center justify-between gap-3 py-4 transition-colors hover:border-border-strong">
          <div>
            <div className="flex items-center gap-2">
              <SectionLabel>Blind Mode</SectionLabel>
              {blindPlan && <StatusBadge tone="accent">In progress</StatusBadge>}
            </div>
            <p className="mt-1 text-sm font-medium">One problem, timed, no hints, no pattern label.</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-muted">→</span>
        </Panel>
      </Link>

      <Link href="/oa">
        <Panel className="flex items-center justify-between gap-3 py-4 transition-colors hover:border-border-strong">
          <div>
            <div className="flex items-center gap-2">
              <SectionLabel>Mock OA</SectionLabel>
              {oaPlan && <StatusBadge tone="accent">In progress</StatusBadge>}
            </div>
            <p className="mt-1 text-sm font-medium">15 / 30 / 45 / 60 minutes, multiple problems, exam conditions.</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-muted">→</span>
        </Panel>
      </Link>
    </div>
  );
}
