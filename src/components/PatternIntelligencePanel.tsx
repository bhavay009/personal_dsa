"use client";

import { useState } from "react";
import Link from "next/link";
import { SectionLabel, StatusBadge } from "@/components/ui";

// §3, §9, §34: the Pattern Knowledge Card. Teaches the reusable idea — never a
// full solution (§24). Collapsible; BlockRunner controls when it's allowed to
// render at all (only once the pattern is no longer hidden from the learner).

export type PatternKnowledgeClient = {
  key: string;
  whatItIs: string;
  signals: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  coreIdea: string;
  invariant: string;
  template: string;
  commonTraps: string[];
  relatedPatterns: string[];
  interviewTakeaway: string;
  commonVariants: string[];
};

export function PatternIntelligencePanel({
  knowledge,
  confusion,
  defaultOpen = false,
  linkToFullGuide = true,
}: {
  knowledge: PatternKnowledgeClient;
  confusion?: { other: string; count: number } | null;
  defaultOpen?: boolean;
  linkToFullGuide?: boolean;
}) {
  // §34: "the panel can automatically open" once the problem is reviewed.
  // `userToggled` is null until the user manually clicks the header — until
  // then, `open` tracks `defaultOpen` live (so it flips open post-solve), and
  // once the user has interacted, their choice wins. This avoids syncing state
  // in an effect (which would just re-derive the same value on every render).
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const open = userToggled ?? defaultOpen;

  return (
    <div className="rounded-lg border border-border">
      <button onClick={() => setUserToggled(!open)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
        <span className="text-sm font-semibold">Pattern Intelligence — {knowledge.key}</span>
        <span className="text-xs text-muted">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <p className="text-sm text-foreground/80">{knowledge.whatItIs}</p>

          {confusion && (
            <div className="rounded-md border border-warning bg-warning-bg px-3 py-2">
              <p className="text-xs font-semibold text-warning">YOU OFTEN CONFUSE THESE</p>
              <p className="mt-1 text-sm text-foreground/80">
                {knowledge.key} vs {confusion.other} — mixed up {confusion.count} times so far.
              </p>
            </div>
          )}

          <Section title="When you see this, think...">
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/80">
              {knowledge.whenToUse.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Section>

          <Section title="Signals to notice">
            <div className="flex flex-wrap gap-1.5">
              {knowledge.signals.map((s) => (
                <span key={s} className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-foreground/70">
                  {s}
                </span>
              ))}
            </div>
          </Section>

          <Section title="When NOT to use it">
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/80">
              {knowledge.whenNotToUse.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Section>

          {/* The two ideas that actually matter for solving the problem — given
              more visual weight than the reference sections around them (§14:
              "don't make all sections equally heavy; the most important
              information should stand out"). */}
          <EmphasisSection title="Core idea">{knowledge.coreIdea}</EmphasisSection>
          <EmphasisSection title="Invariant">{knowledge.invariant}</EmphasisSection>

          {knowledge.commonVariants.length > 0 && (
            <Section title="Common variants">
              <div className="flex flex-wrap gap-1.5">
                {knowledge.commonVariants.map((v) => (
                  <StatusBadge key={v}>{v}</StatusBadge>
                ))}
              </div>
            </Section>
          )}

          <Section title="Common traps">
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/80">
              {knowledge.commonTraps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Section>

          <Section title="Template">
            <pre className="overflow-x-auto rounded-md bg-surface-muted p-2.5 text-xs text-foreground/80">{knowledge.template}</pre>
          </Section>

          {knowledge.relatedPatterns.length > 0 && (
            <Section title="Related patterns">
              <div className="flex flex-wrap gap-1.5">
                {knowledge.relatedPatterns.map((p) =>
                  linkToFullGuide ? (
                    <Link key={p} href={`/patterns/${encodeURIComponent(p)}`} className="text-xs text-accent underline-offset-2 hover:underline">
                      {p}
                    </Link>
                  ) : (
                    <span key={p} className="text-xs text-muted">
                      {p}
                    </span>
                  ),
                )}
              </div>
            </Section>
          )}

          <Section title="Interview takeaway">
            <p className="text-sm text-foreground/80">{knowledge.interviewTakeaway}</p>
          </Section>

          {linkToFullGuide && (
            <Link href={`/patterns/${encodeURIComponent(knowledge.key)}`} className="self-start text-xs text-muted hover:text-foreground hover:underline">
              Open the full pattern guide →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function EmphasisSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border-l-2 border-accent bg-surface-muted py-2 pl-3">
      <SectionLabel>{title}</SectionLabel>
      <p className="mt-1 text-sm font-medium text-foreground">{children}</p>
    </div>
  );
}
