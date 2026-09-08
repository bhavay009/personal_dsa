import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const STORAGE_DIR = path.join(process.cwd(), "storage", "pdfs");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id: Number(id) } });
  if (!doc) return new Response("Not found", { status: 404 });

  const bytes = await readFile(path.join(STORAGE_DIR, doc.filename)).catch(() => null);
  if (!bytes) return new Response("File missing on disk", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.originalName.replace(/"/g, "")}"`,
    },
  });
}
