-- CreateTable
-- The DocumentFts* DROP TABLE statements Prisma's diff generated for this
-- change were intentionally removed: Prisma doesn't model SQLite FTS5 shadow
-- tables, so it always proposes dropping them on any unrelated schema change.
-- Applying that would destroy the Ask My Notes search index.
CREATE TABLE "PatternKnowledge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "whatItIs" TEXT NOT NULL,
    "signals" TEXT NOT NULL,
    "whenToUse" TEXT NOT NULL,
    "whenNotToUse" TEXT NOT NULL,
    "coreIdea" TEXT NOT NULL,
    "invariant" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "commonTraps" TEXT NOT NULL,
    "relatedPatterns" TEXT NOT NULL,
    "interviewTakeaway" TEXT NOT NULL,
    "commonVariants" TEXT
);

-- CreateTable
CREATE TABLE "UserNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "problemId" INTEGER,
    "pattern" TEXT,
    "topicKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserNote_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PatternKnowledge_key_key" ON "PatternKnowledge"("key");

-- CreateIndex
CREATE INDEX "UserNote_problemId_idx" ON "UserNote"("problemId");

-- CreateIndex
CREATE INDEX "UserNote_pattern_idx" ON "UserNote"("pattern");

-- CreateIndex
CREATE INDEX "UserNote_topicKey_idx" ON "UserNote"("topicKey");
