// The zero-to-hero DSA curriculum: a single fixed ordering for a single-user
// app. `key` matches a value in PATTERNS (constants.ts) — this is deliberately
// NOT a parallel taxonomy, it's ordering + teaching content layered on top of
// the same pattern vocabulary already used by Problem/Attempt/PatternPrediction.
//
// Content is curated and static, not AI-generated (no LLM is configured in
// this app — same principle as session-engine's rule-based composition).
// Kept concise on purpose (§25: "do not generate a huge lecture").
//
// List-shaped fields (coreConcepts, keyPatterns, commonMistakes, interviewClues)
// are plain string arrays here and JSON.stringify'd at seed time, since SQLite
// has no native array column type.

export type CurriculumTopicSeed = {
  key: string;
  name: string;
  stage: "Foundation" | "Core Data Structures" | "Algorithms" | "Dynamic Programming";
  order: number;
  prerequisites: string[]; // informational/display only
  overview: string;
  whyItMatters: string;
  coreConcepts: string[];
  keyPatterns: string[];
  commonMistakes: string[];
  interviewClues: string[];
};

export const CURRICULUM_TOPICS: CurriculumTopicSeed[] = [
  // ---------- Foundation ----------
  {
    key: "Arrays",
    name: "Arrays",
    stage: "Foundation",
    order: 1,
    prerequisites: [],
    overview: "Contiguous, indexable memory — the base structure almost every other pattern is built on top of.",
    whyItMatters: "Nearly every interview problem touches an array; weak array fundamentals make every later topic harder than it needs to be.",
    coreConcepts: [
      "Index-based O(1) access vs. O(n) search",
      "In-place mutation vs. allocating a new array",
      "Iterating forwards, backwards, and from both ends",
      "Off-by-one boundaries and empty/single-element edge cases",
    ],
    keyPatterns: ["Traversal with a running accumulator", "In-place swap/partition", "Sorting as a pre-step"],
    commonMistakes: [
      "Mutating an array while iterating it forward",
      "Missing the empty-array or single-element edge case",
      "Assuming input is sorted when it isn't",
    ],
    interviewClues: ["\"Given an array of integers...\"", "Anything asking for in-place with O(1) extra space"],
  },
  {
    key: "Strings",
    name: "Strings",
    stage: "Foundation",
    order: 2,
    prerequisites: ["Arrays"],
    overview: "Arrays of characters with their own quirks — immutability in some languages, character-set assumptions, and encoding edge cases.",
    whyItMatters: "String manipulation shows up constantly and is where sloppy array habits (like repeated concatenation) quietly become O(n²).",
    coreConcepts: [
      "Strings as read-only arrays in many languages",
      "ASCII/lowercase-only assumptions vs. full Unicode",
      "Building output efficiently (array-join vs. repeated concatenation)",
      "Palindrome and reversal mechanics",
    ],
    keyPatterns: ["Character frequency counting", "Two-pointer scan from both ends", "Sliding window over substrings"],
    commonMistakes: [
      "Repeated string concatenation in a loop (hidden O(n²))",
      "Forgetting case sensitivity or non-letter characters",
      "Not clarifying the allowed character set before coding",
    ],
    interviewClues: ["\"Given a string s...\"", "Anagram, palindrome, or substring in the prompt"],
  },
  {
    key: "Hashing",
    name: "Hashing",
    stage: "Foundation",
    order: 3,
    prerequisites: ["Arrays"],
    overview: "Trading memory for near-O(1) lookup — the single highest-leverage tool for turning an O(n²) brute force into O(n).",
    whyItMatters: "A huge fraction of 'optimize this' interview follow-ups are answered by adding a hash map.",
    coreConcepts: [
      "Hash map for O(1) average lookup/insert",
      "Hash set for existence checks and deduplication",
      "Trading space for time",
      "Hash collisions and why average-case isn't worst-case",
    ],
    keyPatterns: ["Complement lookup (two-sum family)", "Frequency map", "Seen-before / visited set"],
    commonMistakes: [
      "Reaching for nested loops before considering a hash map",
      "Using a list where a set would give O(1) membership",
      "Forgetting hash maps don't preserve order (in some languages)",
    ],
    interviewClues: ["\"Find a pair that sums to...\"", "\"Count occurrences of...\"", "\"Have you seen this before?\""],
  },
  {
    key: "Two Pointers",
    name: "Two Pointers",
    stage: "Foundation",
    order: 4,
    prerequisites: ["Arrays"],
    overview: "Two indices moving through a structure (toward each other, or at different speeds) to avoid a nested loop.",
    whyItMatters: "One of the most common ways to drop an O(n²) brute force to O(n) on sorted or linear data.",
    coreConcepts: [
      "Opposite-direction pointers on sorted data",
      "Same-direction fast/slow pointers",
      "When two pointers requires sorting first",
    ],
    keyPatterns: ["Pair-sum on sorted array", "Partitioning / Dutch flag", "Fast-slow cycle detection"],
    commonMistakes: [
      "Forgetting to sort when the technique depends on order",
      "Off-by-one when pointers cross",
      "Not handling duplicate values when uniqueness is required",
    ],
    interviewClues: ["Sorted array + \"find a pair/triplet\"", "\"Without extra space\" on an array problem"],
  },
  {
    key: "Sliding Window",
    name: "Sliding Window",
    stage: "Foundation",
    order: 5,
    prerequisites: ["Two Pointers", "Arrays"],
    overview: "A contiguous window over an array or string that expands and contracts, avoiding recomputation from scratch each time.",
    whyItMatters: "The standard tool for 'longest/shortest/contains substring or subarray with property X.'",
    coreConcepts: [
      "Expand-right, shrink-left invariant maintenance",
      "Fixed-size vs. variable-size windows",
      "Incrementally updating window state instead of recomputing",
    ],
    keyPatterns: ["Longest substring without repeating characters", "Minimum window containing target", "Fixed-size max/min subarray"],
    commonMistakes: [
      "Recomputing the window's state from scratch on every shift",
      "Wrong shrink condition, causing an invalid window to stay valid",
      "Confusing 'longest' and 'shortest' window loop structure",
    ],
    interviewClues: ["\"Contiguous subarray/substring\"", "\"Longest/shortest/maximum window with...\""],
  },
  {
    key: "Prefix Sum",
    name: "Prefix Sum",
    stage: "Foundation",
    order: 6,
    prerequisites: ["Arrays"],
    overview: "Precomputing cumulative sums so any range-sum query becomes O(1) instead of re-summing the range.",
    whyItMatters: "Turns repeated range-sum queries from O(n) each into O(1) each after one O(n) precompute — a very cheap, high-value trick.",
    coreConcepts: [
      "prefix[i] = sum of first i elements",
      "range_sum(l, r) = prefix[r] - prefix[l-1]",
      "Extending to prefix XOR / prefix count for other associative operations",
      "Hash map of prefix sums for subarray-sum-equals-k",
    ],
    keyPatterns: ["Range sum queries", "Subarray sum equals K via prefix + hash map", "2D prefix sum for submatrix queries"],
    commonMistakes: [
      "Off-by-one on the prefix array's indexing/offset",
      "Recomputing a range sum in a loop instead of using the precomputed array",
      "Forgetting negative numbers break monotonicity assumptions",
    ],
    interviewClues: ["\"Multiple range-sum queries\"", "\"Subarray that sums to k\""],
  },
  {
    key: "Stack",
    name: "Stack",
    stage: "Foundation",
    order: 7,
    prerequisites: ["Arrays"],
    overview: "LIFO structure for tracking 'most recent unmatched thing' — parentheses, nested structure, and undo-style problems.",
    whyItMatters: "The natural structure whenever a problem has nested or 'most recent first' matching behavior.",
    coreConcepts: [
      "Last-in-first-out ordering",
      "Push/pop/peek in O(1)",
      "Using a stack to defer decisions until a closing condition is seen",
    ],
    keyPatterns: ["Balanced parentheses / matching brackets", "Next greater/smaller element (monotonic groundwork)", "Expression evaluation"],
    commonMistakes: [
      "Not checking the stack is non-empty before popping",
      "Forgetting to check the stack is empty at the end (unmatched opens)",
      "Using a queue where LIFO order was actually required",
    ],
    interviewClues: ["\"Valid parentheses\"", "\"Nested\" structure in the prompt", "Undo/backtrack semantics"],
  },
  {
    key: "Queue",
    name: "Queue",
    stage: "Foundation",
    order: 8,
    prerequisites: ["Arrays"],
    overview: "FIFO structure for processing things in arrival order — the backbone of level-order traversal and BFS.",
    whyItMatters: "Every BFS is a queue underneath; understanding it well here makes graph/tree BFS much easier later.",
    coreConcepts: [
      "First-in-first-out ordering",
      "Enqueue/dequeue in O(1) (with a proper deque, not a list with pop(0))",
      "Using queue size snapshots to process 'one level at a time'",
    ],
    keyPatterns: ["Level-order processing", "Sliding window maximum (monotonic deque)", "Task/request scheduling simulation"],
    commonMistakes: [
      "Using a plain array's pop(0) as a queue (silently O(n) per operation)",
      "Forgetting to snapshot the queue length before a level-order loop mutates it",
    ],
    interviewClues: ["\"Level by level\"", "\"Process in the order received\""],
  },

  // ---------- Core Data Structures ----------
  {
    key: "Linked List",
    name: "Linked List",
    stage: "Core Data Structures",
    order: 9,
    prerequisites: ["Arrays"],
    overview: "Nodes linked by pointers instead of contiguous memory — O(1) insertion/deletion at a known position, no random access.",
    whyItMatters: "Tests pointer discipline directly, and is the conceptual bridge into trees (a tree is just a linked list with multiple next-pointers).",
    coreConcepts: [
      "Singly vs. doubly linked, with/without a tail pointer",
      "Dummy/sentinel head to simplify edge cases",
      "Fast/slow pointer for cycle detection and middle-finding",
      "Reversal by re-pointing next references",
    ],
    keyPatterns: ["Reverse a linked list (iterative/recursive)", "Detect and locate a cycle", "Merge two sorted lists"],
    commonMistakes: [
      "Losing the reference to the next node before re-pointing current.next",
      "Forgetting to handle an empty list or single-node list",
      "Off-by-one when finding the middle with fast/slow pointers",
    ],
    interviewClues: ["\"Given the head of a linked list...\"", "\"Without using extra space\" on a list problem"],
  },
  {
    key: "Binary Search",
    name: "Binary Search",
    stage: "Core Data Structures",
    order: 10,
    prerequisites: ["Arrays"],
    overview: "Halving the search space each step on monotonic data — not just for sorted arrays, but for any 'answer space' that's monotonic.",
    whyItMatters: "One of the most transferable ideas in the whole curriculum: it applies to arrays, rotated arrays, and 'search for the answer' optimization problems alike.",
    coreConcepts: [
      "Invariant: the answer always stays within [lo, hi]",
      "lo <= hi vs. lo < hi loop shapes and what each guarantees",
      "Binary search on the answer, not just on an array's values",
      "Handling duplicates and finding first/last occurrence",
    ],
    keyPatterns: ["Search in rotated sorted array", "Find first/last position of an element", "Binary search on answer (minimize the maximum, etc.)"],
    commonMistakes: [
      "Infinite loop from an incorrect mid update (off-by-one on lo/hi)",
      "Integer overflow from (lo + hi) / 2 in languages where it matters",
      "Applying binary search to non-monotonic data",
    ],
    interviewClues: ["\"Sorted array\" + \"find\"", "\"Minimize the maximum\" / \"maximize the minimum\""],
  },
  {
    key: "Monotonic Stack",
    name: "Monotonic Stack",
    stage: "Core Data Structures",
    order: 11,
    prerequisites: ["Stack"],
    overview: "A stack kept strictly increasing or decreasing, used to find the next/previous greater or smaller element in O(n) total.",
    whyItMatters: "Turns an apparent O(n²) 'for each element, scan the rest' problem into a single O(n) pass.",
    coreConcepts: [
      "Maintaining a strictly increasing or decreasing stack of indices",
      "Popping while the invariant is violated, then pushing",
      "Why every element is pushed and popped at most once (amortized O(n))",
    ],
    keyPatterns: ["Next greater element", "Daily temperatures", "Largest rectangle in histogram"],
    commonMistakes: [
      "Storing values instead of indices when the index is needed for distance",
      "Getting the increasing/decreasing direction backwards for the question asked",
    ],
    interviewClues: ["\"Next greater/smaller element\"", "\"For each element, how far until...\""],
  },
  {
    key: "Trees",
    name: "Trees",
    stage: "Core Data Structures",
    order: 12,
    prerequisites: ["Linked List"],
    overview: "Hierarchical nodes with children — the structure underlying BSTs, heaps, tries, and most 'divide the problem' recursive thinking.",
    whyItMatters: "Recursive tree traversal is the gateway skill for backtracking, DFS, and dynamic programming on trees.",
    coreConcepts: [
      "Preorder / inorder / postorder / level-order traversal",
      "Recursive thinking: solve for a node in terms of its children's answers",
      "Height, depth, and balance",
      "Base case discipline (null node) in every recursive tree function",
    ],
    keyPatterns: ["DFS traversal (recursive or with an explicit stack)", "BFS/level-order traversal", "Compute a property bottom-up (height, diameter, sum)"],
    commonMistakes: [
      "Missing the null-node base case, causing a crash on leaves",
      "Confusing preorder/inorder/postorder when the problem depends on the order",
      "Returning a value from a helper but forgetting to combine it with the recursive call's result",
    ],
    interviewClues: ["\"Given the root of a binary tree...\"", "\"Diameter,\" \"height,\" \"path sum\""],
  },
  {
    key: "BST",
    name: "Binary Search Trees",
    stage: "Core Data Structures",
    order: 13,
    prerequisites: ["Trees", "Binary Search"],
    overview: "A tree with the ordering invariant (left < node < right) that makes search, insert, and delete all O(log n) on average.",
    whyItMatters: "Combines binary search's halving idea with tree recursion — a frequent 'design a data structure' interview building block.",
    coreConcepts: [
      "BST invariant and why inorder traversal yields sorted order",
      "Search/insert/delete and why delete is the tricky one (successor/predecessor swap)",
      "Degenerate (linked-list-shaped) BSTs and why balance matters",
    ],
    keyPatterns: ["Validate a BST", "Find kth smallest via inorder traversal", "Lowest common ancestor using the ordering invariant"],
    commonMistakes: [
      "Validating a BST by only checking immediate children instead of the full valid range",
      "Forgetting the BST invariant lets you skip a whole subtree instead of visiting it",
    ],
    interviewClues: ["\"Binary search tree\" explicitly in the prompt", "\"kth smallest/largest\""],
  },
  {
    key: "Heap",
    name: "Heap / Priority Queue",
    stage: "Core Data Structures",
    order: 14,
    prerequisites: ["Trees"],
    overview: "A structure that always gives you the min (or max) element in O(log n) update time — the go-to for 'top/smallest K' problems.",
    whyItMatters: "Answers a huge class of 'k largest/smallest/most frequent' questions in O(n log k) instead of a full O(n log n) sort.",
    coreConcepts: [
      "Min-heap vs. max-heap and how to simulate one with the other",
      "O(log n) push/pop, O(1) peek at the extreme",
      "Bounding heap size to k for top-k problems",
    ],
    keyPatterns: ["Top-k / kth largest element", "Merge k sorted lists", "Running median with two heaps"],
    commonMistakes: [
      "Using a full sort (O(n log n)) when a bounded heap (O(n log k)) is what's asked for",
      "Forgetting most languages default to a min-heap and need a workaround for max-heap behavior",
    ],
    interviewClues: ["\"Top k\"", "\"Kth largest/smallest\"", "\"Median of a stream\""],
  },

  // ---------- Algorithms ----------
  {
    key: "BFS",
    name: "Breadth-First Search",
    stage: "Algorithms",
    order: 15,
    prerequisites: ["Queue", "Trees"],
    overview: "Level-by-level exploration using a queue — the standard way to find shortest paths in an unweighted graph.",
    whyItMatters: "Whenever a problem says 'shortest' or 'minimum steps' on unweighted connections, BFS is almost always the answer.",
    coreConcepts: [
      "Queue-driven level-by-level expansion",
      "Visited-set tracking to avoid revisiting and infinite loops",
      "Why BFS guarantees the shortest path in unweighted graphs",
      "Multi-source BFS (seeding the queue with several starting nodes)",
    ],
    keyPatterns: ["Shortest path in an unweighted grid/graph", "Level-order tree traversal", "Multi-source spread (e.g. rotting oranges)"],
    commonMistakes: [
      "Marking a node visited on dequeue instead of on enqueue (causes duplicate work)",
      "Forgetting a visited set entirely and looping forever on a cyclic graph",
    ],
    interviewClues: ["\"Shortest path\" / \"minimum number of steps\" + unweighted", "\"Level by level\" on a graph"],
  },
  {
    key: "DFS",
    name: "Depth-First Search",
    stage: "Algorithms",
    order: 16,
    prerequisites: ["Trees"],
    overview: "Exploring as deep as possible before backtracking — via recursion or an explicit stack — used for reachability, connectivity, and path enumeration.",
    whyItMatters: "The base traversal underneath graph connectivity, topological sort, and most backtracking solutions.",
    coreConcepts: [
      "Recursive DFS vs. explicit-stack DFS",
      "Visited tracking to handle cycles",
      "Entry/exit timing for problems like detecting a cycle in a directed graph",
    ],
    keyPatterns: ["Connected components / island counting", "Path existence between two nodes", "Cycle detection in a directed graph"],
    commonMistakes: [
      "Stack overflow from recursion depth on very deep/large graphs",
      "Forgetting to mark a node visited before recursing, causing infinite recursion on a cycle",
    ],
    interviewClues: ["\"Number of islands/connected components\"", "\"Does a path exist between...\""],
  },
  {
    key: "Graphs",
    name: "Graphs",
    stage: "Algorithms",
    order: 17,
    prerequisites: ["BFS", "DFS"],
    overview: "Nodes and edges as a general model — the umbrella structure that BFS, DFS, topological sort, and shortest-path algorithms all operate on.",
    whyItMatters: "Graph representation choices (adjacency list vs. matrix) and traversal fluency underpin a large slice of 'hard' interview questions.",
    coreConcepts: [
      "Adjacency list vs. adjacency matrix and when to use each",
      "Directed vs. undirected, weighted vs. unweighted",
      "Representing implicit graphs (e.g. a grid, or word transformations)",
    ],
    keyPatterns: ["Building an adjacency list from edge input", "Detecting connectivity/components", "Treating a grid as an implicit graph"],
    commonMistakes: [
      "Building an undirected graph's adjacency list with only one direction",
      "Not recognizing a grid or state-transition problem as a graph in disguise",
    ],
    interviewClues: ["Explicit \"graph\" with nodes/edges given", "A grid problem that's secretly graph traversal"],
  },
  {
    key: "Topological Sort",
    name: "Topological Sort",
    stage: "Algorithms",
    order: 18,
    prerequisites: ["Graphs", "DFS"],
    overview: "Ordering nodes in a directed acyclic graph so every edge points forward — the standard tool for dependency/prerequisite problems.",
    whyItMatters: "The direct algorithmic answer to any 'in what order can these tasks be done' question with dependencies.",
    coreConcepts: [
      "Only defined on a DAG — a cycle means no valid ordering exists",
      "Kahn's algorithm (in-degree + queue) vs. DFS-with-postorder-reversal",
      "Detecting a cycle as a side effect of failing to produce a full ordering",
    ],
    keyPatterns: ["Course schedule / prerequisite ordering", "Build order from dependency list", "Cycle detection in a directed graph"],
    commonMistakes: [
      "Not checking whether the result covers all nodes (a cycle silently leaves nodes out)",
      "Confusing DFS-postorder topological sort's need for a final reversal",
    ],
    interviewClues: ["\"Prerequisite\" / \"course schedule\" / \"build order\""],
  },
  {
    key: "Backtracking",
    name: "Backtracking",
    stage: "Algorithms",
    order: 19,
    prerequisites: ["Trees"],
    overview: "Exhaustive search with pruning — build a candidate incrementally, abandon it the moment it can't work, and undo the choice before trying the next.",
    whyItMatters: "The standard technique for 'generate all' or 'find any valid' problems where brute force is exponential but pruning makes it tractable.",
    coreConcepts: [
      "Choose → explore → un-choose (the state must be restored after recursing)",
      "Pruning: cutting a branch early once it's provably invalid",
      "Distinguishing 'find one solution' from 'find all solutions'",
    ],
    keyPatterns: ["Subsets / permutations / combinations generation", "N-Queens / Sudoku-style constraint search", "Word search / path enumeration on a grid"],
    commonMistakes: [
      "Forgetting to undo a choice (mutate-then-forget-to-revert) after a recursive branch returns",
      "Missing a base case, causing infinite or excessive recursion",
      "Not pruning early enough, leading to needless exponential blowup",
    ],
    interviewClues: ["\"Generate all possible...\"", "\"All valid arrangements/combinations\""],
  },
  {
    key: "Greedy",
    name: "Greedy",
    stage: "Algorithms",
    order: 20,
    prerequisites: ["Arrays"],
    overview: "Making the locally-best choice at each step and trusting it leads to a globally optimal result — valid only when the problem actually has that property.",
    whyItMatters: "When it applies, greedy gives an elegant O(n log n) solution; the real skill is recognizing when it's actually correct vs. when it's a trap.",
    coreConcepts: [
      "The exchange-argument idea: why the greedy choice can't be beaten",
      "Sorting as a common greedy pre-step",
      "Recognizing when greedy fails and DP is actually required",
    ],
    keyPatterns: ["Interval scheduling / merging", "Assign resources to maximize/minimize a total", "Jump game reachability"],
    commonMistakes: [
      "Applying greedy to a problem that actually needs DP (no exchange-argument proof)",
      "Sorting by the wrong key (e.g. start time when end time was needed)",
    ],
    interviewClues: ["\"Maximum/minimum number of...\" with intervals or resources", "\"Non-overlapping intervals\""],
  },

  // ---------- Dynamic Programming ----------
  {
    key: "Dynamic Programming",
    name: "Dynamic Programming",
    stage: "Dynamic Programming",
    order: 21,
    prerequisites: ["Backtracking", "Greedy"],
    overview: "Solving a problem by combining solutions to overlapping subproblems, storing each subproblem's answer once instead of recomputing it.",
    whyItMatters: "The topic most candidates find hardest — pattern recognition here (spotting overlapping subproblems + optimal substructure) is the actual skill being tested, more than any single trick.",
    coreConcepts: [
      "Overlapping subproblems + optimal substructure — the two conditions DP requires",
      "Top-down memoization vs. bottom-up tabulation",
      "Defining the state (what does dp[i] or dp[i][j] actually mean?) before writing any code",
      "Space optimization: rolling array when only the last row/state is needed",
    ],
    keyPatterns: ["1D DP (climbing stairs, house robber)", "2D/grid DP (unique paths, edit distance)", "Knapsack-style choose/skip DP", "DP on subsequences (longest increasing subsequence)"],
    commonMistakes: [
      "Writing the recurrence before clearly defining what the state represents",
      "Off-by-one in the base cases or array sizing",
      "Reaching for brute-force recursion without memoization and hitting exponential blowup",
    ],
    interviewClues: ["\"Number of ways to...\"", "\"Minimum/maximum cost to...\"", "\"Longest/shortest subsequence with property X\""],
  },
];
