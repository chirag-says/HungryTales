import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Person } from "@/lib/domain";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

const BUTTON_VARIANTS = {
  primary: "bg-accent text-on-accent hover:brightness-110 active:brightness-95 shadow-sm",
  ink: "bg-ink text-paper hover:opacity-90 active:opacity-80",
  soft: "bg-paper-2 text-ink hover:bg-line/60 active:bg-line",
  ghost: "text-ink-2 hover:bg-paper-2 active:bg-line/60",
  outline: "border border-line text-ink hover:bg-paper-2 active:bg-line/60",
  danger: "bg-transparent border border-accent/40 text-accent hover:bg-accent-soft",
} as const;

const BUTTON_SIZES = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-full",
  md: "h-11 px-4 text-[0.95rem] gap-2 rounded-full",
  lg: "h-13 px-6 text-base gap-2 rounded-full",
  icon: "h-11 w-11 rounded-full",
} as const;

type ButtonStyle = { variant?: keyof typeof BUTTON_VARIANTS; size?: keyof typeof BUTTON_SIZES };

export function buttonClass({ variant = "soft", size = "md" }: ButtonStyle = {}, extra?: string) {
  return cx(
    "inline-flex items-center justify-center font-medium transition-[filter,background-color,opacity,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    extra,
  );
}

export function Button({ variant, size, className, busy, children, disabled, ...rest }: ComponentProps<"button"> & ButtonStyle & { busy?: boolean }) {
  return (
    <button {...rest} disabled={disabled || busy} aria-busy={busy || undefined} className={buttonClass({ variant, size }, className)}>
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, ...rest }: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link {...rest} className={buttonClass({ variant, size }, className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("eyebrow", className)}>{children}</p>;
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        <h2 className="font-display text-2xl leading-tight text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-ink-3">{icon}</div> : null}
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {body ? <p className="mt-2 max-w-sm text-ink-2">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-xl bg-paper-2", className)} />;
}

export function PersonDot({ person, className }: { person: Pick<Person, "slot">; className?: string }) {
  return <span aria-hidden className={cx("inline-block size-2 rounded-full", person.slot === 1 ? "bg-p1" : "bg-p2", className)} />;
}

export function Avatar({ person, size = "md" }: { person: Pick<Person, "name" | "slot">; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "size-6 text-[0.7rem]", md: "size-8 text-sm", lg: "size-12 text-lg" }[size];
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold",
        person.slot === 1 ? "bg-p1/15 text-p1" : "bg-p2/15 text-p2",
        dims,
      )}
    >
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}

export function Chip({
  active,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...rest}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
        active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:border-ink-3",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, error, htmlFor, children, optional }: { label: string; hint?: ReactNode; error?: string; htmlFor?: string; children: ReactNode; optional?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
        {label}
        {optional ? <span className="font-normal text-ink-3"> · optional</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-ink-3 focus:border-ink-3 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent";

export const textareaClass =
  "min-h-24 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink placeholder:text-ink-3 focus:border-ink-3 focus:outline-none";
