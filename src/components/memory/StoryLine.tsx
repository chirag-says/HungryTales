"use client";

import { Pencil, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, textareaClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toaster";
import { LIMITS } from "@/lib/domain";
import { updateStory } from "@/server/actions/memories";

/**
 * The one-line story. Generated from the memory's facts until someone rewrites it;
 * the label says which it is, and the generated version can always be restored.
 */
export function StoryLine({ memoryId, story, isGenerated }: { memoryId: string; story: string; isGenerated: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(story);
  const [pending, startTransition] = useTransition();

  const save = (value: string | null) =>
    startTransition(async () => {
      const result = await updateStory(memoryId, value);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      setEditing(false);
    });

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea aria-label="Story" value={draft} maxLength={LIMITS.storyMax} onChange={(e) => setDraft(e.target.value)} className={textareaClass} autoFocus />
        <div className="flex gap-2">
          <Button size="sm" variant="ink" busy={pending} onClick={() => save(draft.trim() || null)}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <Button size="sm" variant="ghost" className="-ml-3 self-start" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" aria-hidden /> Write a line about this meal
      </Button>
    );
  }

  return (
    <div>
      <p className="font-display text-xl leading-snug text-ink-2 italic">{story}</p>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-3">
        <span>{isGenerated ? "Written from your details" : "Written by you"}</span>
        <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-8 items-center gap-1 underline underline-offset-4">
          <Pencil className="size-3" aria-hidden /> Edit
        </button>
        {!isGenerated ? (
          <button type="button" onClick={() => save(null)} className="inline-flex min-h-8 items-center gap-1 underline underline-offset-4">
            <RotateCcw className="size-3" aria-hidden /> Use generated
          </button>
        ) : null}
      </div>
    </div>
  );
}
