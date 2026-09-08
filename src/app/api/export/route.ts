import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [problems, exams, documents] = await Promise.all([
    prisma.problem.findMany({
      orderBy: { createdAt: "asc" },
      include: { attempts: { orderBy: { date: "asc" } } },
    }),
    prisma.exam.findMany({ orderBy: { date: "asc" } }),
    prisma.document.findMany({ orderBy: { uploadedAt: "asc" } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    problems,
    exams,
    documents, // metadata only — the PDF files themselves live in storage/pdfs/, back that up separately
  };

  const date = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="prepos-backup-${date}.json"`,
    },
  });
}
