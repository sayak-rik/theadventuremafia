import { BadgeCheck } from "lucide-react";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { ShareButton } from "@/components/marketplace/ShareButton";
import { StatusDot, COMPANY_STATUS } from "@/components/ui/status";
import { requireOperatorPage } from "@/lib/operator-auth";
import { getCompanyProfile } from "@/lib/operators/account";
import { getLaunchCategories, getRegions } from "@/lib/taxonomy";
import { SITE } from "@/data/site";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireOperatorPage();
  const [profile, categories, regions] = await Promise.all([getCompanyProfile(session.companyId), getLaunchCategories(), getRegions()]);
  const status = COMPANY_STATUS[profile.status] ?? COMPANY_STATUS.pending;
  const publicUrl = `${SITE.url}/companies/${session.companySlug}`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy">Profile</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-navy/75">
          <StatusDot tone={status.tone}>{status.label}</StatusDot>
          {profile.isVerified && <span className="inline-flex items-center gap-1.5 font-medium text-navy"><BadgeCheck className="h-4 w-4 text-gold" aria-hidden /> Mafia Verified</span>}
          <span>Signs in as {session.email}</span>
        </div>
      </div>

      {session.companyStatus === "approved" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy/10 bg-white p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy">Your public page</p>
            <p className="truncate text-sm text-navy/60">{publicUrl}</p>
          </div>
          <ShareButton url={publicUrl} title={session.companyName} />
        </div>
      )}

      <ProfileForm profile={profile} categories={categories} regions={regions} />
    </div>
  );
}
