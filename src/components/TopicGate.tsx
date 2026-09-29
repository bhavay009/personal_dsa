"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceTopicAction } from "@/app/actions";
import { PrimaryButton, SecondaryButton, Rationale } from "@/components/ui";

// §5/§19: the always-visible override. The system advises (via `ready` and
// `gaps`), the user decides — "Move Anyway" is never hidden or disabled, it's
// just honest about what evidence is still missing when readiness isn't met.
export function TopicGate({
  topicKey,
  topicName,
  ready,
  gaps,
  nextTopicName,
}: {
  topicKey: string;
  topicName: string;
  ready: boolean;
  gaps: string[];
  nextTopicName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmingOverride, setConfirmingOverride] = useState(false);
  const router = useRouter();

  function advance(override: boolean) {
    startTransition(async () => {
      await advanceTopicAction(topicKey, override);
      router.push("/roadmap");
    });
  }

  if (!nextTopicName) {
    return (
      <div className="rounded-lg border border-border-strong bg-surface-muted p-4">
        <p className="text-sm font-semibold">Final topic in the curriculum</p>
        <p className="mt-1 text-sm text-muted">There&apos;s no next topic queued after {topicName} yet.</p>
      </div>
    );
  }

  if (ready) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-muted p-4">
        <p className="text-sm font-semibold">READY TO ADVANCE ✓</p>
        <p className="text-sm text-muted">Every required dimension has enough evidence and is strong.</p>
        <PrimaryButton onClick={() => advance(false)} disabled={pending} className="self-start">
          Next: {nextTopicName}
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <p className="text-sm font-semibold">NOT READY TO MOVE ON YET</p>
      <p className="text-sm text-muted">Still developing:</p>
      <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/80">
        {gaps.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={() => router.push("/today")} disabled={pending} className="text-sm">
          Continue {topicName}
        </PrimaryButton>
        {!confirmingOverride ? (
          <SecondaryButton onClick={() => setConfirmingOverride(true)} disabled={pending} className="text-sm">
            Move to next topic anyway
          </SecondaryButton>
        ) : null}
      </div>
      {confirmingOverride && (
        <div className="flex flex-col gap-2">
          <Rationale>
            The system advises staying on {topicName} — the gaps above are real. You decide. Moving on now will be
            recorded as a manual override, not as the coach saying you&apos;re ready.
          </Rationale>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => advance(true)} disabled={pending} className="text-sm">
              Confirm — move to {nextTopicName}
            </SecondaryButton>
            <button onClick={() => setConfirmingOverride(false)} className="text-xs text-muted underline-offset-2 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
