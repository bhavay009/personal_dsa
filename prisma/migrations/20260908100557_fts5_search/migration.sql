-- Full-text search over uploaded PDFs (Ask My Notes), no AI needed.
CREATE VIRTUAL TABLE "DocumentFts" USING fts5(
  originalName,
  extractedText,
  content='Document',
  content_rowid='id'
);

-- Keep the FTS index in sync with Document writes.
CREATE TRIGGER "Document_ai" AFTER INSERT ON "Document" BEGIN
  INSERT INTO "DocumentFts"(rowid, originalName, extractedText)
  VALUES (new.id, new.originalName, new.extractedText);
END;

CREATE TRIGGER "Document_ad" AFTER DELETE ON "Document" BEGIN
  INSERT INTO "DocumentFts"("DocumentFts", rowid, originalName, extractedText)
  VALUES ('delete', old.id, old.originalName, old.extractedText);
END;

CREATE TRIGGER "Document_au" AFTER UPDATE ON "Document" BEGIN
  INSERT INTO "DocumentFts"("DocumentFts", rowid, originalName, extractedText)
  VALUES ('delete', old.id, old.originalName, old.extractedText);
  INSERT INTO "DocumentFts"(rowid, originalName, extractedText)
  VALUES (new.id, new.originalName, new.extractedText);
END;
