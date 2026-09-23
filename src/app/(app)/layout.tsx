import { AddMemoryLauncher } from "@/components/shell/AddMemoryLauncher";
import { BottomNav, SideNav } from "@/components/shell/AppNav";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { Toaster } from "@/components/ui/Toaster";
import { requireMember } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireMember();
  return (
    <Toaster>
      <AddMemoryLauncher>
        <div className="flex min-h-dvh">
          <SideNav journalName={session.duo.name} meName={session.me.name} />
          <div className="min-w-0 flex-1 pb-28 md:pb-12">
            <OfflineBanner />
            {children}
          </div>
        </div>
        <BottomNav />
      </AddMemoryLauncher>
    </Toaster>
  );
}
