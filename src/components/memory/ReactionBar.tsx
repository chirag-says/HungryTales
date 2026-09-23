"use client";

import { useOptimistic, useTransition } from "react";
import { cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toaster";
import { REACTIONS, type Person, type ReactionKind } from "@/lib/domain";
import { toggleReaction } from "@/server/actions/memories";

type Reaction = { personId: string; kind: ReactionKind };

/** Small, intentional reactions. Tapping yours toggles it; counts show who reacted. */
export function ReactionBar({ memoryId, reactions, me, persons }: { memoryId: string; reactions: Reaction[]; me: Person; persons: Person[] }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [optimistic, apply] = useOptimistic(reactions, (current: Reaction[], kind: ReactionKind) =>
    current.some((r) => r.personId === me.id && r.kind === kind) ? current.filter((r) => !(r.personId === me.id && r.kind === kind)) : [...current, { personId: me.id, kind }],
  );

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Reactions">
      {REACTIONS.map(({ kind, emoji, label }) => {
        const who = optimistic.filter((r) => r.kind === kind);
        const mine = who.some((r) => r.personId === me.id);
        const names = who.map((r) => persons.find((p) => p.id === r.personId)?.name).filter(Boolean);
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={mine}
            aria-label={`${label}${names.length ? `, from ${names.join(" and ")}` : ""}`}
            title={names.length ? names.join(" & ") : label}
            onClick={() =>
              startTransition(async () => {
                apply(kind);
                const result = await toggleReaction({ memoryId, kind });
                if (!result.ok) toast(result.error, "error");
              })
            }
            className={cx(
              "inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-lg transition-colors",
              mine ? "border-ink bg-paper-2" : "border-line hover:border-ink-3",
            )}
          >
            <span aria-hidden>{emoji}</span>
            {who.length ? <span className="text-sm tabular-nums text-ink-2">{who.length}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
