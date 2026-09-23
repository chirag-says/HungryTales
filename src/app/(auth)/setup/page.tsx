import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { isSetupComplete } from "@/server/queries/setup";
import { SetupFlow } from "./SetupFlow";

export const metadata: Metadata = { title: "Start your journal" };

export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/unlock");
  return <SetupFlow needsSetupCode={Boolean(env().SETUP_CODE)} />;
}
