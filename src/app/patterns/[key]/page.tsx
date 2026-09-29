import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfusionFor, getPatternKnowledge, getPossibleTakeaways, getQuizForPattern } from "@/lib/pattern-knowledge";
import { getNotesFor } from "@/lib/notes";
import { Panel, SectionLabel } from "@/components/ui";
import { PatternIntelligencePanel } from "@/components/PatternIntelligencePanel";
import { MyNotesPanel } from "@/components/MyNotesPanel";
import { RecognitionQuiz } from "@/components/RecognitionQuiz";

export const dynamic = "force-dynamic";

// §29: "LEARN PATTERN" mode — the full guide plus a no-coding recognition quiz,
// plus this pattern's own notes (§17: "This creates a personal DSA handbook
// over time").

export default async function PatternDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const patternKey = decodeURIComponent(key);
  const [knowledge, confusionRaw, notesRaw] = await Promise.all([
    getPatternKnowledge(patternKey),
    getConfusionFor(patternKey),
    getNotesFor({ pattern: patternKey }),
  ]);
  if (!knowledge) notFound();

  const confusion = confusionRaw
    ? { other: confusionRaw.patternA === patternKey ? confusionRaw.patternB : confusionRaw.patternA, count: confusionRaw.count }
    : null;
  const notes = notesRaw.map((n) => ({ id: n.id, type: n.type, content: n.content, createdAt: n.createdAt.toISOString() }));
  const quiz = getQuizForPattern(patternKey);
  const suggestions = getPossibleTakeaways(knowledge);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/patterns" className="text-xs text-muted hover:text-foreground hover:underline">
          ← Pattern Library
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{knowledge.key}</h1>
        {confusion && (
          <div className="mt-2 rounded-md border border-warning bg-warning-bg px-3 py-2">
            <p className="text-xs font-semibold text-warning">YOU OFTEN CONFUSE THESE</p>
            <p className="mt-1 text-sm text-foreground/80">
              {knowledge.key} vs {confusion.other} — mixed up {confusion.count} times so far.
            </p>
          </div>
        )}
      </div>

      <PatternIntelligencePanel knowledge={knowledge} confusion={confusion} defaultOpen linkToFullGuide={false} />

      <div>
        <SectionLabel>Test yourself — recognition quiz</SectionLabel>
        <Panel className="mt-2">
          <RecognitionQuiz questions={quiz} />
        </Panel>
      </div>

      <MyNotesPanel scope={{ pattern: patternKey }} notes={notes} suggestions={suggestions} defaultOpen={notes.length > 0} />
    </div>
  );
}
