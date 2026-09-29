-- CreateTable
-- The DocumentFts* DROP TABLE statements Prisma's diff generated for this
-- change were intentionally removed: Prisma doesn't model SQLite FTS5 shadow
-- tables, so it always proposes dropping them on any unrelated schema change.
-- Applying that would destroy the Ask My Notes search index.
CREATE TABLE "CurriculumTopic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prerequisites" TEXT,
    "overview" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "coreConcepts" TEXT NOT NULL,
    "keyPatterns" TEXT NOT NULL,
    "commonMistakes" TEXT NOT NULL,
    "interviewClues" TEXT NOT NULL,
    "startedAt" DATETIME,
    "advancedAt" DATETIME,
    "userOverrideAdvanced" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumTopic_key_key" ON "CurriculumTopic"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumTopic_order_key" ON "CurriculumTopic"("order");

-- CreateIndex
CREATE INDEX "CurriculumTopic_stage_idx" ON "CurriculumTopic"("stage");
