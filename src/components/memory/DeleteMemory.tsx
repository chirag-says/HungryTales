"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toaster";
import { deleteMemory } from "@/server/actions/memories";

export function DeleteMemory({ memoryId, photoCount }: { memoryId: string; photoCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 border-t border-line pt-8">
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        Delete this memory
      </Button>
      <ConfirmDialog
        open={open}
        destructive
        busy={pending}
        title="Delete this memory?"
        body={
          <>
            This removes the memory, both of your reviews and reactions
            {photoCount ? `, and its ${photoCount === 1 ? "photo" : `${photoCount} photos`} from storage` : ""}. It can&apos;t be undone.
          </>
        }
        confirmLabel="Delete forever"
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteMemory(memoryId);
            if (!result.ok) {
              toast(result.error, "error");
              setOpen(false);
              return;
            }
            toast("Memory deleted");
            router.replace("/memories");
            router.refresh();
          })
        }
      />
    </div>
  );
}
