// Human-readable labels for session-block kinds — client-safe (no server imports)
// so both the server-rendered /today page and the client BlockRunner can share
// one vocabulary instead of showing raw enum strings like "NEWPROBLEM".
export const KIND_LABEL: Record<string, string> = {
  Recall: "Recall Check",
  Drill: "Focused Practice",
  NewProblem: "New Problem",
  Transfer: "Transfer Challenge",
  Revision: "Review",
  Timed: "Timed Test",
};

// Short verb used to build the "Today's goal: Recall → Solve → Transfer" chain.
export const KIND_PURPOSE: Record<string, string> = {
  Recall: "Recall",
  Drill: "Reconstruct",
  NewProblem: "Solve",
  Transfer: "Transfer",
  Revision: "Resolve",
  Timed: "Timed test",
};
