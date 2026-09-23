import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { costFromMinor } from "@/components/composer/cost";
import { MemoryComposer } from "@/components/composer/MemoryComposer";
import { DeleteMemory } from "@/components/memory/DeleteMemory";
import { requireMember } from "@/lib/auth/session";
import type { FieldSource } from "@/lib/domain";
import { todayIn } from "@/lib/engine/dates";
import { loadComposerCatalog } from "@/server/queries/catalog";
import { getMemoryDetail } from "@/server/queries/memories";

export const metadata: Metadata = { title: "Edit memory" };

export default async function EditMemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMember();
  const { id } = await params;
  const [memory, catalog] = await Promise.all([getMemoryDetail(session, id), loadComposerCatalog(session)]);
  if (!memory) notFound();

  const provenance = memory.provenance as { date?: FieldSource; time?: FieldSource; location?: FieldSource };
  return (
    <>
      <MemoryComposer
        mode="edit"
        memoryId={memory.id}
        catalog={catalog}
        persons={session.persons}
        me={session.me}
        currency={session.duo.currency}
        today={todayIn(session.duo.timezone)}
        initial={{
          eatenOn: memory.eatenOn,
          eatenAt: memory.eatenAt,
          place: memory.place ? { mode: "existing", id: memory.place.id, name: memory.place.name, area: memory.place.area } : null,
          location:
            memory.latitude != null && memory.longitude != null
              ? { lat: memory.latitude, lng: memory.longitude, source: provenance.location === "photo" || provenance.location === "device" ? provenance.location : "user" }
              : null,
          locationLabel: memory.locationLabel ?? "",
          category: memory.category ?? "",
          foods: memory.foods.map((f) => f.name),
          cost: costFromMinor(memory.costMinor, memory.shares, session.duo.currency, session.persons),
          notes: memory.notes ?? "",
          discoveredById: memory.discoveredById,
          provenance,
          story: memory.storyIsGenerated ? null : memory.story,
          photos: memory.photos.map((p) => ({
            id: p.id,
            thumbUrl: p.thumbUrl,
            width: p.width,
            height: p.height,
            bytes: p.bytes,
            isCover: p.isCover,
            takenAt: p.takenAt,
            contentHash: p.contentHash,
          })),
        }}
      />
      <div className="mx-auto max-w-5xl px-5 pb-40 md:px-6">
        <DeleteMemory memoryId={memory.id} photoCount={memory.photos.length} />
      </div>
    </>
  );
}
