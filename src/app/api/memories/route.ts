import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { browseMemories, filtersFromParams } from "@/server/queries/browse";

/** Paginated memory cards for infinite scroll and live search. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  if (q && q.length > 200) return NextResponse.json({ error: "Query too long" }, { status: 400 });
  try {
    const page = await browseMemories(session, {
      q,
      filters: filtersFromParams((k) => sp.get(k)),
      cursor: sp.get("cursor"),
      limit: Number(sp.get("limit")) || undefined,
    });
    return NextResponse.json(page, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", route: "GET /api/memories", message: String(error) }));
    return NextResponse.json({ error: "Could not load memories" }, { status: 500 });
  }
}
