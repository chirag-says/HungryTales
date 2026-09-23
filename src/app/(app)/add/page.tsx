import type { Metadata } from "next";
import { costFromMinor } from "@/components/composer/cost";
import { MemoryComposer } from "@/components/composer/MemoryComposer";
import { requireMember } from "@/lib/auth/session";
import { localPartsIn } from "@/lib/engine/dates";
import { loadComposerCatalog } from "@/server/queries/catalog";
import { loadWishes } from "@/server/queries/plan";

export const metadata: Metadata = { title: "New memory" };

export default async function AddMemoryPage({ searchParams }: { searchParams: Promise<{ wish?: string }> }) {
  const session = await requireMember();
  const { wish: wishId } = await searchParams;
  const [catalog, wishes] = await Promise.all([loadComposerCatalog(session), wishId ? loadWishes(session) : Promise.resolve([])]);
  const wish = wishes.find((w) => w.id === wishId && !w.doneAt) ?? null;
  const now = localPartsIn(session.duo.timezone);

  return (
    <MemoryComposer
      mode="create"
      catalog={catalog}
      persons={session.persons}
      me={session.me}
      currency={session.duo.currency}
      today={now.date}
      wish={wish ? { id: wish.id, title: wish.title } : null}
      initial={{
        eatenOn: now.date,
        eatenAt: now.time,
        place: wish?.placeName ? { mode: "new", name: wish.placeName, area: wish.area ?? "" } : null,
        location: null,
        locationLabel: "",
        category: wish?.category ?? "",
        foods: wish && !wish.placeName ? [wish.title] : [],
        cost: costFromMinor(null, null, session.duo.currency, session.persons),
        notes: "",
        discoveredById: null,
        provenance: { date: "device", time: "device" },
        story: null,
        photos: [],
      }}
    />
  );
}
