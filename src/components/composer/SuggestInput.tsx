"use client";

import { useId, useState, type ReactNode } from "react";
import { cx, inputClass } from "@/components/ui/primitives";

export interface SuggestOption {
  key: string;
  label: ReactNode;
  hint?: ReactNode;
}

/**
 * Accessible combobox: typing filters, arrow keys move, Enter picks the highlighted
 * option (or commits free text when nothing is highlighted), Escape closes.
 */
export function SuggestInput({
  id,
  value,
  onChange,
  options,
  onPick,
  onCommit,
  placeholder,
  label,
  autoFocus,
  enterKeyHint = "done",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SuggestOption[];
  onPick: (key: string) => void;
  onCommit?: () => void;
  placeholder?: string;
  label: string;
  autoFocus?: boolean;
  enterKeyHint?: "done" | "next" | "enter";
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const visible = open && options.length > 0;

  const pick = (key: string) => {
    onPick(key);
    setActive(-1);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={label}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint={enterKeyHint}
        className={inputClass}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(options.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === "Enter") {
            if (visible && active >= 0) {
              e.preventDefault();
              pick(options[active].key);
            } else if (onCommit) {
              e.preventDefault();
              onCommit();
              setOpen(false);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {visible ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-auto rounded-xl border border-line bg-surface py-1 shadow-lg">
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.key)}
              className={cx("flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3.5 py-2", i === active ? "bg-paper-2" : "hover:bg-paper-2/60")}
            >
              <span className="text-ink">{o.label}</span>
              {o.hint ? <span className="shrink-0 text-xs text-ink-3">{o.hint}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
