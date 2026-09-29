"use client";

import { useState } from "react";
import { PrimaryButton, StatusBadge } from "@/components/ui";
import type { QuizQuestion } from "@/lib/pattern-knowledge-data";

// §29-§30: recognition-only quiz — no coding, tests "which pattern would you
// investigate first," including keyword-absent scenarios so it can't be beaten
// by memorizing trigger words.

export function RecognitionQuiz({ questions }: { questions: QuizQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);

  if (questions.length === 0) return <p className="text-sm text-muted">No recognition quiz for this pattern yet.</p>;

  const done = index >= questions.length;

  if (done) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Quiz complete.</p>
        <button
          onClick={() => {
            setIndex(0);
            setAnswered(null);
          }}
          className="self-start text-xs text-muted hover:text-foreground hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const q = questions[index];
  const options = [...q.distractors, q.correctPattern].sort();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Question {index + 1} of {questions.length}
      </p>
      <p className="text-sm font-medium">{q.scenario}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isCorrect = opt === q.correctPattern;
          const showResult = answered !== null;
          return (
            <button
              key={opt}
              onClick={() => setAnswered(opt)}
              disabled={showResult}
              className={`rounded-md border px-3 py-1.5 text-sm disabled:cursor-default ${
                showResult && isCorrect
                  ? "border-success bg-success-bg text-success"
                  : showResult && opt === answered
                    ? "border-danger bg-danger-bg text-danger"
                    : "border-border-strong hover:bg-surface-muted"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted p-3">
          <StatusBadge tone={answered === q.correctPattern ? "success" : "danger"}>
            {answered === q.correctPattern ? "Correct" : `Not quite — it's ${q.correctPattern}`}
          </StatusBadge>
          <p className="text-sm text-foreground/80">{q.explanation}</p>
          <PrimaryButton
            onClick={() => {
              setAnswered(null);
              setIndex(index + 1);
            }}
            className="self-start text-xs"
          >
            {index + 1 < questions.length ? "Next question" : "Finish"}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
