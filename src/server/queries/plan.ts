import "server-only";
import { desc, eq } from "drizzle-orm";
import type { Session } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { wishlistItems } from "@/lib/db/schema";
import type { WishCandidate } from "@/lib/engine/roulette";

export interface WishView extends WishCandidate {
  note: string | null;
  addedById: string | null;
  doneAt: string | null;
  doneMemoryId: string | null;
  createdAt: string;
}

export async function loadWishes(session: Session): Promise<WishView[]> {
  const db = await getDb();
  const rows = await db.select().from(wishlistItems).where(eq(wishlistItems.duoId, session.duo.id)).orderBy(desc(wishlistItems.createdAt)).limit(300);
  const nameOf = (id: string | null) => session.persons.find((p) => p.id === id)?.name ?? null;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    placeName: r.placeName,
    area: r.area,
    category: r.category,
    estimatedCostMinor: r.estimatedCostMinor,
    addedByName: nameOf(r.addedById),
    addedById: r.addedById,
    note: r.note,
    doneAt: r.doneAt?.toISOString() ?? null,
    doneMemoryId: r.doneMemoryId,
    createdAt: r.createdAt.toISOString(),
  }));
}
