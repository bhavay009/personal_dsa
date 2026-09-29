-- AlterTable
ALTER TABLE "SessionBlock" ADD COLUMN "revisionTargetId" INTEGER;

-- The DocumentFts* DROP TABLE statements Prisma's diff generated for this change
-- were intentionally removed: Prisma doesn't model SQLite FTS5 shadow tables, so it
-- always proposes dropping them on any unrelated schema change. Applying that would
-- destroy the Ask My Notes search index.
