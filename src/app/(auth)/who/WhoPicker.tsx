"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar, Spinner } from "@/components/ui/primitives";
import type { Person } from "@/lib/domain";
import { chooseWho } from "@/server/actions/auth";

export function WhoPicker({ persons, currentId }: { persons: Person[]; currentId: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="mt-8 flex flex-col gap-3">
      {persons.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={choosing != null}
          onClick={() => {
            setChoosing(p.id);
            startTransition(async () => {
              const result = await chooseWho(p.id);
              if (result.ok) {
                router.replace("/");
                router.refresh();
              } else {
                setError(result.error);
                setChoosing(null);
              }
            });
          }}
          className="flex h-18 items-center gap-4 rounded-2xl border border-line bg-surface px-5 text-left transition-colors hover:border-ink-3 disabled:opacity-60"
        >
          <Avatar person={p} size="lg" />
          <span className="flex-1 font-display text-2xl">I&apos;m {p.name}</span>
          {choosing === p.id ? <Spinner /> : currentId === p.id ? <Check className="size-5 text-ink-3" aria-label="Current" /> : null}
        </button>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
