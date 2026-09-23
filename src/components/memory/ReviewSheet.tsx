"use client";

import { useState, useTransition } from "react";
import { RatingInput } from "@/components/ui/RatingInput";
import { Sheet } from "@/components/ui/Sheet";
import { Button, Chip, inputClass } from "@/components/ui/primitives";
import { LIMITS, WOULD_EAT_AGAIN, type Person, type WouldEatAgain } from "@/lib/domain";
import { overallOf } from "@/lib/engine/ratings";
import { saveReview } from "@/server/actions/memories";
import type { ReviewView } from "@/server/queries/memories";

const EAT_AGAIN_LABEL: Record<WouldEatAgain, string> = { yes: "Yes", maybe: "Maybe", no: "No" };

/** "How was it?" in a few taps: three ratings, eat-again, one line. */
export function ReviewSheet({
  open,
  onClose,
  memoryId,
  me,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  memoryId: string;
  me: Person;
  existing: ReviewView | null;
  onSaved: () => void;
}) {
  const [taste, setTaste] = useState<number | null>(existing?.taste ?? null);
  const [quantity, setQuantity] = useState<number | null>(existing?.quantity ?? null);
  const [value, setValue] = useState<number | null>(existing?.value ?? null);
  const [overall, setOverall] = useState<number | null>(existing?.overall ?? null);
  const [again, setAgain] = useState<WouldEatAgain | null>(existing?.wouldEatAgain ?? null);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tone = me.slot === 1 ? "p1" : "p2";
  const derived = overallOf({ taste, quantity, value, overall: null });

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveReview({ memoryId, taste, quantity, value, overall, wouldEatAgain: again, comment: comment || null });
      if (result.ok) onSaved();
      else setError(result.error);
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="How was it?"
      description={`Your take, ${me.name}. Your friend adds theirs separately.`}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Later
          </Button>
          <Button variant="ink" onClick={save} busy={pending} className="flex-[2]">
            Save my review
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        <RatingInput label="Taste" value={taste} onChange={setTaste} tone={tone} />
        <RatingInput label="Quantity" value={quantity} onChange={setQuantity} tone={tone} />
        <RatingInput label="Value for money" value={value} onChange={setValue} tone={tone} />
        <RatingInput label={overall == null && derived != null ? `Overall (${derived} from the three above)` : "Overall"} value={overall} onChange={setOverall} tone={tone} />
        <div>
          <p className="mb-2 text-sm font-medium text-ink-2">Would you eat it again?</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Would you eat it again?">
            {WOULD_EAT_AGAIN.map((w) => (
              <Chip key={w} active={again === w} onClick={() => setAgain(again === w ? null : w)} className="h-11 justify-center">
                {EAT_AGAIN_LABEL[w]}
              </Chip>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
          One line
          <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={LIMITS.commentMax} placeholder="Too spicy, perfect biryani…" className={inputClass} />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-accent">
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
