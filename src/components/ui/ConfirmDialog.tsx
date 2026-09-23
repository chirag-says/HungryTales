"use client";

import type { ReactNode } from "react";
import { Sheet } from "./Sheet";
import { Button } from "./primitives";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet open={open} onClose={busy ? () => {} : onCancel} title={title}>
      <div className="text-ink-2">{body}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? "primary" : "ink"} onClick={onConfirm} busy={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
