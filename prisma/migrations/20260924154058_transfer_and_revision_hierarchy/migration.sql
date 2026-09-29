-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN "confidence" INTEGER;
ALTER TABLE "Attempt" ADD COLUMN "revisionLevel" INTEGER;

-- AlterTable
ALTER TABLE "PatternPrediction" ADD COLUMN "confidence" INTEGER;
ALTER TABLE "PatternPrediction" ADD COLUMN "reasoning" TEXT;

-- AlterTable
ALTER TABLE "SessionBlock" ADD COLUMN "revisionLevel" INTEGER;

-- RedefineTables (Problem: add revisionLevel with NOT NULL DEFAULT — SQLite requires
-- a table rebuild for this shape of column add. The DocumentFts* DROP TABLE statements
-- Prisma's own diff generated for this change were intentionally removed here: Prisma
-- doesn't model SQLite FTS5 shadow tables, so it always proposes dropping them on any
-- unrelated schema change. Applying that would destroy the Ask My Notes search index.)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Problem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "pattern" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Unsolved',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "intervalDays" REAL NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "revisionLevel" INTEGER NOT NULL DEFAULT 4
);
INSERT INTO "new_Problem" ("createdAt", "difficulty", "easeFactor", "id", "intervalDays", "notes", "pattern", "repetitions", "status", "title", "url") SELECT "createdAt", "difficulty", "easeFactor", "id", "intervalDays", "notes", "pattern", "repetitions", "status", "title", "url" FROM "Problem";
DROP TABLE "Problem";
ALTER TABLE "new_Problem" RENAME TO "Problem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
