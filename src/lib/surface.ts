// Transfer training needs "same pattern, different surface" (§12 of the coach spec).
// The problem data has no surface/archetype/domain field — only title, url, pattern,
// difficulty. Rather than inventing a fake `surface` column with hand-wavy or
// AI-guessed labels (explicitly ruled out — see the coach spec's honesty
// requirement), this derives a coarse surface tag deterministically from the title
// text every time it's needed. It is NOT persisted: it's cheap to compute, and
// keeping it derived means it can never drift from the title and needs no backfill
// or migration.
//
// Limitation, stated plainly: this is a keyword bucket over LeetCode-style titles,
// not a real understanding of problem structure. Two problems can land in the same
// bucket despite being meaningfully different, and a title with no recognizable
// keyword falls into "other". It is trustworthy for what it claims — a rough proxy
// for "does this look like the same kind of problem on the surface" — and no more.
const SURFACE_KEYWORDS: [tag: string, keywords: string[]][] = [
  ["string/substring", ["string", "substring", "subsequence", "palindrome", "anagram", "parenthes", "word"]],
  ["array/subarray", ["array", "subarray", "sum", "product", "rotate", "duplicate"]],
  ["matrix/grid", ["matrix", "grid", "island", "board", "maze"]],
  ["interval/range", ["interval", "range", "merge", "schedule", "calendar"]],
  ["linked-list", ["linked list", "list node"]],
  ["tree", ["tree", "bst", "binary tree", "trie"]],
  ["graph", ["graph", "island", "course", "network", "connected"]],
  ["stack/queue", ["stack", "queue", "deque", "monotonic"]],
  ["heap/top-k", ["heap", "kth", "top k", "median"]],
  ["counting/frequency", ["count", "frequency", "occurrence", "unique"]],
  ["numeric/math", ["number", "digit", "math", "sum", "power", "prime"]],
  ["simulation/game", ["game", "simulate", "robot", "path", "maze"]],
  ["stock/finance", ["stock", "price", "profit"]],
  ["water/container", ["water", "container", "trap", "rain"]],
];

export function deriveSurfaceTag(title: string): string {
  const lower = title.toLowerCase();
  for (const [tag, keywords] of SURFACE_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return tag;
  }
  return "other";
}
