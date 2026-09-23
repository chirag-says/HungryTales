"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./primitives";

/**
 * Bottom sheet on phones, centred dialog on larger screens. Built on <dialog>,
 * so focus trapping, Escape and the inert background come from the browser.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cx("sheet", className)}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-2">
            <div>
              <h2 id={titleId} className="font-display text-xl text-ink">
                {title}
              </h2>
              {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="-mr-2 grid size-10 place-items-center rounded-full text-ink-2 hover:bg-paper-2" aria-label="Close">
              <X className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          {footer ? <div className="pb-safe shrink-0 border-t border-line px-5 py-3">{footer}</div> : <div className="pb-safe" />}
        </div>
      ) : null}
    </dialog>
  );
}
