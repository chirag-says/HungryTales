"use client";

import { BookHeart, Compass, Dices, Home, Settings, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddMemoryButton } from "./AddMemoryLauncher";
import { cx } from "@/components/ui/primitives";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/memories", label: "Memories", icon: BookHeart },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/plan", label: "Plan", icon: Dices },
  { href: "/us", label: "Us", icon: UsersRound },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/add") || pathname.startsWith("/story") || pathname.endsWith("/edit")) return null;
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/92 backdrop-blur-md md:hidden">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx("flex h-full flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium", active ? "text-ink" : "text-ink-3")}
              >
                <Icon className="size-[1.35rem]" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav({ journalName, meName }: { journalName: string; meName: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-5 py-8 md:flex lg:w-64">
      <Link href="/" className="font-display text-2xl leading-tight text-ink">
        {journalName}
      </Link>
      <p className="mt-1 text-sm text-ink-3">Our food story</p>
      <AddMemoryButton className="mt-8 w-full" />
      <nav aria-label="Main" className="mt-8">
        <ul className="flex flex-col gap-1">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] transition-colors",
                    active ? "bg-paper-2 font-medium text-ink" : "text-ink-2 hover:bg-paper-2/70",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Link href="/settings" className="mt-auto flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-ink-2 hover:bg-paper-2/70">
        <Settings className="size-5" aria-hidden />
        <span>
          Settings <span className="text-ink-3">· {meName}</span>
        </span>
      </Link>
    </aside>
  );
}
