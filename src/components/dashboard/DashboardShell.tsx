import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StatusDot, COMPANY_STATUS } from "@/components/ui/status";
import type { OperatorSession } from "@/lib/operator-auth";
import { SideNav, SignOutButton, TabBar } from "./DashNav";

export function DashboardShell({ session, children }: { session: OperatorSession; children: React.ReactNode }) {
  const status = COMPANY_STATUS[session.companyStatus] ?? COMPANY_STATUS.pending;
  return (
    <div className="min-h-screen bg-[#f4f5f1] md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col justify-between bg-navy p-4 md:flex">
        <div>
          <Link href="/" aria-label="The Adventure Mafia home" className="mb-6 block px-1 pt-1"><Logo /></Link>
          <SideNav companyType={session.companyType} />
        </div>
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div className="px-1">
            <p className="truncate text-sm font-semibold text-cream">{session.companyName}</p>
            <StatusDot tone={status.tone} className="text-cream/70">{status.label}</StatusDot>
          </div>
          <SignOutButton className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-cream/65 hover:bg-white/5 hover:text-cream" />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-navy/10 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-navy">{session.companyName}</p>
            <StatusDot tone={status.tone} className="text-[13px]">{status.label}</StatusDot>
          </div>
          <SignOutButton className="flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-navy/70 hover:bg-navy/5" />
        </header>
        <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-6 md:px-8 md:pb-16 md:pt-10">{children}</main>
      </div>
      <TabBar companyType={session.companyType} />
    </div>
  );
}
