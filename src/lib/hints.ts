// Progressive hint ladder (§8). Client-safe — no Prisma import.
//
// These are deliberately QUESTIONS, not explanations. The spec's own example:
// bad  = "Use a hashmap and store target - nums[i]."
// good = "What would you need to know about previously seen elements?"
//
// They're also deliberately problem-agnostic. A generic question that makes you
// re-derive the answer yourself beats a specific hint that hands it over, and it
// works today without an LLM. When a model is wired in, it fills the same slots
// with problem-specific phrasing — the ladder and its telemetry don't change.

export const MAX_HINT_LEVEL = 8;

// Level 5+ counts as heavy intervention: past this point you were told the
// shape of the answer rather than finding it. Used to score "implementation"
// in the mastery model and to detect hint dependency in the session engine.
export const HEAVY_HINT_LEVEL = 5;

export type HintLevel = {
  level: number;
  title: string;
  prompts: string[];
};

export const HINT_LADDER: HintLevel[] = [
  {
    level: 1,
    title: "Re-read",
    prompts: [
      "Restate the problem in one sentence without reusing words from the statement.",
      "What exactly is being asked for — a value, an index, a count, or a structure?",
      "Solve the smallest non-trivial example by hand. What did you actually do?",
    ],
  },
  {
    level: 2,
    title: "Constraints",
    prompts: [
      "What is the largest input size? What complexity does that rule out?",
      "What's special about the input — sorted, unique, bounded range, non-negative?",
      "What should happen on the smallest possible input? On the largest?",
    ],
  },
  {
    level: 3,
    title: "Shape of the problem",
    prompts: [
      "Is the answer about a contiguous run, a pair, an ordering, or a choice at each step?",
      "If the input were sorted, would this get easier? Why?",
      "Is a smaller version of this same problem hiding inside it?",
    ],
  },
  {
    level: 4,
    title: "Algorithm direction",
    prompts: [
      "Could you trade memory for time by remembering something you've already seen?",
      "Is the search space monotonic — if X works, does everything past X also work?",
      "Would processing the input from the other end change anything?",
    ],
  },
  {
    level: 5,
    title: "Invariant and state",
    prompts: [
      "What must stay true after every iteration of your loop?",
      "What is the minimum state you must carry forward? Name each variable and its meaning.",
      "At the moment you produce the answer, what do you know that you didn't at the start?",
    ],
  },
  {
    level: 6,
    title: "Pseudocode",
    prompts: [
      "Write the loop skeleton with no logic inside: what do you iterate over, what updates each step?",
      "State the base case and the transition in plain words before writing any code.",
    ],
  },
  {
    level: 7,
    title: "Implementation",
    prompts: [
      "Which boundary is inclusive and which is exclusive? Write it down before coding.",
      "List your edge cases now: empty, single element, all-equal, duplicates, overflow.",
      "Which off-by-one is most likely here, and how will you test for it?",
    ],
  },
  {
    level: 8,
    title: "Full solution",
    prompts: [
      "Read the editorial — then close it and re-implement from memory before moving on.",
      "Log this attempt as needed-solution so it comes back for revision sooner.",
    ],
  },
];

export function hintAt(level: number): HintLevel | null {
  return HINT_LADDER.find((h) => h.level === level) ?? null;
}
