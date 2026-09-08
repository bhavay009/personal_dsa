// Client-safe constants — no server/Prisma imports here, so client components can use them
// without pulling the native SQLite driver into the browser bundle.

export const PATTERNS = [
  "Arrays",
  "Strings",
  "Hashing",
  "Two Pointers",
  "Sliding Window",
  "Prefix Sum",
  "Binary Search",
  "Linked List",
  "Stack",
  "Queue",
  "Monotonic Stack",
  "Trees",
  "BST",
  "Heap",
  "BFS",
  "DFS",
  "Graphs",
  "Topological Sort",
  "Greedy",
  "Backtracking",
  "Dynamic Programming",
  "Other",
] as const;

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export const OUTCOMES = ["Solved", "Failed", "Partial"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const MISTAKE_TAGS = [
  { value: "concept", label: "Concept" },
  { value: "pattern-recognition", label: "Pattern recognition" },
  { value: "logic", label: "Logic" },
  { value: "coding", label: "Coding" },
  { value: "edge-case", label: "Edge case" },
  { value: "time-complexity", label: "Time complexity" },
  { value: "space-complexity", label: "Space complexity" },
  { value: "misread", label: "Misread question" },
  { value: "needed-hint", label: "Needed hint" },
  { value: "needed-solution", label: "Needed solution" },
  { value: "forgot-concept", label: "Forgot concept" },
  { value: "time-management", label: "Time management" },
] as const;
