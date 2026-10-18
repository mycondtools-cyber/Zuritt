import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await db.media.findUnique({ where: { id: (await params).id } });
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(m.data), {
    headers: { "content-type": m.mime, "cache-control": "public, max-age=31536000, immutable" },
  });
}
