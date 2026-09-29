-- RedefineTables (SessionPlan: add mode with NOT NULL DEFAULT — SQLite requires a
-- table rebuild for this shape of column add. The DocumentFts* DROP TABLE
-- statements Prisma's diff generated for this change were intentionally removed:
-- Prisma doesn't model SQLite FTS5 shadow tables, so it always proposes dropping
-- them on any unrelated schema change. Applying that would destroy the Ask My
-- Notes search index.)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SessionPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goalMin" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "mode" TEXT NOT NULL DEFAULT 'Daily'
);
INSERT INTO "new_SessionPlan" ("date", "goalMin", "id", "status") SELECT "date", "goalMin", "id", "status" FROM "SessionPlan";
DROP TABLE "SessionPlan";
ALTER TABLE "new_SessionPlan" RENAME TO "SessionPlan";
CREATE INDEX "SessionPlan_date_idx" ON "SessionPlan"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
