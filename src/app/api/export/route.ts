import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const problems = await prisma.problem.findMany({
    orderBy: { createdAt: "asc" },
    include: { attempts: { orderBy: { date: "asc" } } },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    problems,
  };

  const date = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="prepos-backup-${date}.json"`,
    },
  });
}
