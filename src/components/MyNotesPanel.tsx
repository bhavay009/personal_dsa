"use client";

import { useState, useTransition } from "react";
import { createNoteAction, deleteNoteAction, updateNoteAction } from "@/app/actions";
import { PrimaryButton, SecondaryButton, SectionLabel, StatusBadge } from "@/components/ui";

// §14-§20: personal notes, collapsible so they never interrupt the coding flow
// (§19). Generic — works for a problem, a pattern, or a topic depending on
// which scope prop is passed; exactly one should usually be set.

const NOTE_TYPE_LABEL: Record<string, string> = {
  takeaway: "My takeaway",
  clue: "Pattern clue",
  mistake: "Mistake",
  template: "Template",
  "edge-case": "Edge case",
  interview: "Interview explanation",
  quick: "Quick note",
};

export type NoteRow = { id: number; type: string; content: string; createdAt: string };

export function MyNotesPanel({
  scope,
  notes,
  suggestions,
  defaultOpen = false,
}: {
  scope: { problemId?: number | null; pattern?: string | null; topicKey?: string | null };
  notes: NoteRow[];
  suggestions?: string[]; // §21: AI-style suggested takeaways — never auto-saved
  defaultOpen?: boolean;
}) {
  // Same "auto-open post-solve, but respect a manual toggle afterward" logic as
  // PatternIntelligencePanel — see its comment for why this isn't an effect.
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const open = userToggled ?? defaultOpen;
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState("quick");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  function addNote(content: string, type: string) {
    if (!content.trim()) return;
    startTransition(async () => {
      await createNoteAction(scope, type, content);
      setDraft("");
      setDraftType("quick");
    });
  }

  return (
    <div className="rounded-lg border border-border">
      <button onClick={() => setUserToggled(!open)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
        <span className="text-sm font-semibold">My Notes{notes.length > 0 && ` (${notes.length})`}</span>
        <span className="text-xs text-muted">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          {suggestions && suggestions.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted p-2.5">
              <SectionLabel>Possible takeaways</SectionLabel>
              {suggestions.map((s) => (
                <div key={s} className="flex items-start justify-between gap-2 text-sm text-foreground/80">
                  <span>{s}</span>
                  <button
                    onClick={() => addNote(s, "takeaway")}
                    disabled={pending}
                    className="shrink-0 text-xs font-medium text-accent underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Add to My Notes
                  </button>
                </div>
              ))}
            </div>
          )}

          {notes.length > 0 && (
            <div className="flex flex-col gap-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-md border border-border p-2.5">
                  {editingId === n.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={2}
                        className="rounded border border-border-strong bg-surface px-2 py-1.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <SecondaryButton
                          onClick={() =>
                            startTransition(async () => {
                              await updateNoteAction(n.id, editDraft);
                              setEditingId(null);
                            })
                          }
                          disabled={pending}
                          className="px-2 py-1 text-xs"
                        >
                          Save
                        </SecondaryButton>
                        <button onClick={() => setEditingId(null)} className="text-xs text-muted hover:underline">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge tone="neutral">{NOTE_TYPE_LABEL[n.type] ?? n.type}</StatusBadge>
                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={() => {
                              setEditingId(n.id);
                              setEditDraft(n.content);
                            }}
                            className="text-muted hover:text-foreground hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => startTransition(() => deleteNoteAction(n.id))}
                            disabled={pending}
                            className="text-muted hover:text-danger hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{n.content}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Add a note — no category required"
              className="rounded border border-border-strong bg-surface px-2 py-1.5 text-sm"
            />
            <div className="flex items-center gap-2">
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value)}
                className="rounded border border-border-strong bg-surface px-2 py-1 text-xs"
              >
                {Object.entries(NOTE_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <PrimaryButton onClick={() => addNote(draft, draftType)} disabled={pending || !draft.trim()} className="px-3 py-1.5 text-xs">
                + Add note
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
