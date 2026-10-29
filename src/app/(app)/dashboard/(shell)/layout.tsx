import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireOperatorPage } from "@/lib/operator-auth";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Operator dashboard" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// NOTE: layouts don't re-run on client-side navigation, so every page below
// also calls requireOperatorPage() itself.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOperatorPage();
  return <DashboardShell session={session}>{children}</DashboardShell>;
}
