"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { assertMember } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { wishlistItems } from "@/lib/db/schema";
import { buildCandidates } from "@/lib/engine/candidates";
import { todayIn } from "@/lib/engine/dates";
import { favouriteCategories } from "@/lib/engine/recommend";
import { ROULETTE_MODES, spinRoulette, type RouletteMode, type RouletteOutcome } from "@/lib/engine/roulette";
import { runAction, UserError, type ActionResult } from "@/server/action-result";
import { loadHistory } from "@/server/queries/history";
import { loadWishes } from "@/server/queries/plan";
import { uuid, wishInput } from "@/server/validation";

export interface OutcomeView {
  kind: "candidate" | "wish";
  title: string;
  subtitle: string | null;
  reasons: string[];
  href: string | null;
  wishId: string | null;
  placeId: string | null;
  avgRating: number | null;
  avgCostMinor: number | null;
}

export type SpinView =
  | { status: "picked"; pick: OutcomeView; alternates: OutcomeView[]; poolSize: number }
  | { status: "empty"; reason: string };

function view(o: RouletteOutcome): OutcomeView {
  if (o.kind === "wish") {
    return {
      kind: "wish",
      title: o.wish.title,
      subtitle: [o.wish.placeName, o.wish.area].filter(Boolean).join(" · ") || null,
      reasons: o.reasons,
      href: null,
      wishId: o.wish.id,
      placeId: null,
      avgRating: null,
      avgCostMinor: o.wish.estimatedCostMinor,
    };
  }
  const c = o.candidate;
  return {
    kind: "candidate",
    title: c.title,
    subtitle: [c.topFood && c.kind === "place" ? `Try: ${c.topFood.name}` : null, c.area].filter(Boolean).join(" · ") || null,
    reasons: o.reasons,
    href: c.placeId ? `/explore/places/${c.placeId}` : `/memories/${c.lastMemoryId}`,
    wishId: null,
    placeId: c.placeId,
    avgRating: c.avgRating == null ? null : Math.round(c.avgRating * 10) / 10,
    avgCostMinor: c.avgCostMinor,
  };
}

const spinInput = z.object({
  mode: z.enum(ROULETTE_MODES.map((m) => m.id) as [RouletteMode, ...RouletteMode[]]),
  maxCostMinor: z.number().int().min(0).nullable(),
  category: z.string().max(60).nullable(),
  here: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable(),
});

export async function spin(raw: unknown): Promise<ActionResult<SpinView>> {
  return runAction("spin", async () => {
    const session = await assertMember();
    const opts = spinInput.parse(raw);
    const [history, wishes] = await Promise.all([loadHistory(session.duo.id), loadWishes(session)]);
    const today = todayIn(session.duo.timezone);
    const result = spinRoulette(
      buildCandidates(history.memories, today),
      wishes.filter((w) => !w.doneAt),
      opts,
      session.persons,
      favouriteCategories(history.memories),
    );
    if (result.status === "empty") return result;
    return { status: "picked", pick: view(result.pick), alternates: result.alternates.map(view), poolSize: result.poolSize };
  });
}

export async function addWish(raw: unknown): Promise<ActionResult<null>> {
  return runAction("addWish", async () => {
    const session = await assertMember();
    const input = wishInput.parse(raw);
    const db = await getDb();
    await db.insert(wishlistItems).values({ ...input, duoId: session.duo.id, addedById: session.me.id });
    refresh();
    return null;
  });
}

export async function removeWish(id: string): Promise<ActionResult<null>> {
  return runAction("removeWish", async () => {
    const session = await assertMember();
    const db = await getDb();
    const deleted = await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.id, uuid.parse(id)), eq(wishlistItems.duoId, session.duo.id)))
      .returning({ id: wishlistItems.id });
    if (!deleted.length) throw new UserError("That item was already removed.", "conflict");
    refresh();
    return null;
  });
}

export async function markWishTried(id: string): Promise<ActionResult<null>> {
  return runAction("markWishTried", async () => {
    const session = await assertMember();
    const db = await getDb();
    await db
      .update(wishlistItems)
      .set({ doneAt: new Date() })
      .where(and(eq(wishlistItems.id, uuid.parse(id)), eq(wishlistItems.duoId, session.duo.id), isNull(wishlistItems.doneAt)));
    refresh();
    return null;
  });
}
