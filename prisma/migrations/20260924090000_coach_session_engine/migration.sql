-- Adaptive session engine + pattern-recognition and hint telemetry (§6-§11).
--
-- Hand-written rather than generated: `prisma migrate diff` wants to DROP the
-- DocumentFts_* shadow tables, because FTS5 creates them internally and they
-- aren't in the Prisma datamodel. Dropping them would destroy the Ask My Notes
-- search index. Only the additive statements are kept here.

-- CreateTable
CREATE TABLE "SessionPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goalMin" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active'
);

-- CreateTable
CREATE TABLE "SessionBlock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "planId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "pattern" TEXT,
    "problemId" INTEGER,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    CONSTRAINT "SessionBlock_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SessionPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatternPrediction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "problemId" INTEGER NOT NULL,
    "predicted" TEXT NOT NULL,
    "actual" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatternPrediction_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HintEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "problemId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "secondsBefore" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HintEvent_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SessionPlan_date_idx" ON "SessionPlan"("date");

-- CreateIndex
CREATE INDEX "SessionBlock_planId_idx" ON "SessionBlock"("planId");

-- CreateIndex
CREATE INDEX "PatternPrediction_problemId_idx" ON "PatternPrediction"("problemId");

-- CreateIndex
CREATE INDEX "HintEvent_problemId_idx" ON "HintEvent"("problemId");
