import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isSetupComplete } from "@/server/queries/setup";
import { UnlockForm } from "./UnlockForm";

export const metadata: Metadata = { title: "Unlock" };

export default async function UnlockPage() {
  if (!(await isSetupComplete())) redirect("/setup");
  const session = await getSession();
  if (session) redirect(session.me ? "/" : "/who");
  return (
    <>
      <h1 className="font-display text-4xl leading-tight text-ink">Welcome back.</h1>
      <p className="mt-3 text-ink-2">Enter your shared passphrase to open the journal.</p>
      <UnlockForm />
    </>
  );
}
