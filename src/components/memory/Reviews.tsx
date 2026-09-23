"use client";

import { Pencil } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar, Button, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toaster";
import type { Person } from "@/lib/domain";
import { formatRating, overallOf } from "@/lib/engine/ratings";
import type { ReviewView } from "@/server/queries/memories";
import { ReviewSheet } from "./ReviewSheet";

const AGAIN: Record<string, string> = { yes: "Would eat again", maybe: "Maybe again", no: "Not again" };

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-display text-lg tabular-nums">{value ?? "–"}</dd>
    </div>
  );
}

/**
 * Both perspectives side by side, never averaged into one. Each person can only
 * edit their own side; the other side is read-only.
 */
export function Reviews({ memoryId, persons, me, reviews }: { memoryId: string; persons: Person[]; me: Person; reviews: ReviewView[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const mine = reviews.find((r) => r.personId === me.id) ?? null;
  const [open, setOpen] = useState(() => params.get("new") === "1" && !mine);

  const close = () => {
    setOpen(false);
    if (params.get("new")) router.replace(`/memories/${memoryId}`, { scroll: false });
  };

  return (
    <section aria-labelledby="reviews-heading" className="@container">
      <h2 id="reviews-heading" className="eyebrow mb-4">
        What you both thought
      </h2>
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
        {persons.map((p) => {
          const r = reviews.find((x) => x.personId === p.id);
          const isMe = p.id === me.id;
          const overall = r ? overallOf(r) : null;
          return (
            <article key={p.id} className={cx("rounded-2xl border p-4", isMe ? "border-line bg-surface" : "border-line/70 bg-paper-2/50")}>
              <header className="flex items-center gap-3">
                <Avatar person={p} />
                <p className="flex-1 font-medium">{p.name}</p>
                {overall != null ? (
                  <p className="font-display text-3xl tabular-nums">
                    {formatRating(overall)}
                    <span className="text-base text-ink-3">/10</span>
                  </p>
                ) : null}
              </header>
              {r ? (
                <>
                  <dl className="mt-3 grid grid-cols-3 gap-2">
                    <Score label="Taste" value={r.taste} />
                    <Score label="Quantity" value={r.quantity} />
                    <Score label="Value" value={r.value} />
                  </dl>
                  {r.wouldEatAgain ? <p className="mt-3 text-sm text-ink-2">{AGAIN[r.wouldEatAgain]}</p> : null}
                  {r.comment ? <blockquote className="font-display mt-2 text-lg leading-snug text-ink">“{r.comment}”</blockquote> : null}
                  {isMe ? (
                    <Button variant="ghost" size="sm" className="mt-3 -ml-3" onClick={() => setOpen(true)}>
                      <Pencil className="size-3.5" aria-hidden /> Edit my review
                    </Button>
                  ) : null}
                </>
              ) : isMe ? (
                <Button variant="ink" size="sm" className="mt-4" onClick={() => setOpen(true)}>
                  Add my review
                </Button>
              ) : (
                <p className="mt-3 text-sm text-ink-3">{p.name} hasn&apos;t reviewed this yet.</p>
              )}
            </article>
          );
        })}
      </div>
      {open ? (
        <ReviewSheet
          open
          onClose={close}
          memoryId={memoryId}
          me={me}
          existing={mine}
          onSaved={() => {
            close();
            toast("Review saved");
          }}
        />
      ) : null}
    </section>
  );
}
