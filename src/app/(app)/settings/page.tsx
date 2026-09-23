import type { Metadata } from "next";
import Link from "next/link";
import { SettingsForms } from "@/components/settings/SettingsForms";
import { buttonClass } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/session";
import { signOut } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireMember();
  return (
    <div className="mx-auto max-w-2xl px-5 pt-6 md:px-8 md:pt-10">
      <h1 className="font-display mb-8 text-4xl">Settings</h1>

      <section className="mb-10 rounded-2xl bg-surface p-5">
        <p className="text-ink-2">
          You&apos;re using this phone as <strong className="font-medium text-ink">{session.me.name}</strong>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/who" className={buttonClass({ variant: "outline", size: "sm" })}>
            Switch to {session.partner?.name ?? "the other person"}
          </Link>
          <form action={signOut}>
            <button type="submit" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Lock this device
            </button>
          </form>
        </div>
      </section>

      <SettingsForms journalName={session.duo.name} persons={session.persons} />
    </div>
  );
}
