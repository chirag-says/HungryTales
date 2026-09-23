import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { WhoPicker } from "./WhoPicker";

export const metadata: Metadata = { title: "Who's here?" };

export default async function WhoPage() {
  const session = await getSession();
  if (!session) redirect("/unlock");
  return (
    <>
      <h1 className="font-display text-4xl leading-tight">Who&apos;s using this phone?</h1>
      <p className="mt-3 text-ink-2">Your ratings and reactions will be saved under this name. You can switch later in settings.</p>
      <WhoPicker persons={session.persons} currentId={session.me?.id ?? null} />
    </>
  );
}
