"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot, LISTING_STATUS } from "@/components/ui/status";
import { api, ApiError } from "@/lib/client-api";

export function SubmitPanel(props: {
  listingId: number;
  status: string;
  moderationNote: string | null;
  hasImages: boolean;
  hasPayment: boolean;
  hasSlots: boolean;
  isSession: boolean;
  willPublishInstantly: boolean;
  companyApproved: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const st = LISTING_STATUS[props.status] ?? LISTING_STATUS.draft;
  const editable = ["draft", "changes_requested", "rejected"].includes(props.status);

  async function submit() {
    setBusy(true); setError(""); setMissing([]);
    try {
      await api(`/api/operator/listings/${props.listingId}/submit`, { body: {} });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) { setError(err.message); setMissing((err.data?.missing as string[]) ?? []); }
      else setError("Couldn't submit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const checks: { ok: boolean; label: string; href?: string }[] = [
    { ok: props.hasImages, label: "At least one photo" },
    { ok: props.hasPayment, label: "Payment details added", href: "/dashboard/payments" },
    ...(props.isSession ? [{ ok: props.hasSlots, label: "At least one time slot" }] : []),
  ];

  return (
    <section aria-labelledby="status" className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="status" className="font-serif text-xl font-bold text-navy">Status</h2>
        <StatusDot tone={st.tone}>{st.label}</StatusDot>
      </div>
      <p className="mt-1 text-sm text-navy/65">{st.help}</p>

      {props.moderationNote && (props.status === "changes_requested" || props.status === "rejected") && (
        <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-[15px] leading-relaxed text-navy">
          <p className="font-semibold">Note from our team</p>
          <p className="mt-1">{props.moderationNote}</p>
        </div>
      )}

      {editable && (
        <>
          <ul className="mt-4 space-y-2">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-3 text-[15px]">
                <span aria-hidden className={`flex h-6 w-6 items-center justify-center rounded-full ${c.ok ? "bg-green text-navy" : "border-2 border-navy/25"}`}>
                  {c.ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Circle className="h-1.5 w-1.5 fill-navy/25 text-navy/25" />}
                </span>
                {c.href && !c.ok ? <Link href={c.href} className="font-medium text-navy underline underline-offset-2">{c.label}</Link> : <span className={c.ok ? "text-navy/60" : "text-navy"}>{c.label}</span>}
              </li>
            ))}
          </ul>
          {!props.companyApproved && (
            <p className="mt-4 text-sm text-navy/70">Your account is still being reviewed. This listing will go live once you're approved and we've reviewed it.</p>
          )}
          {error && (
            <div role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
              {missing.length > 0 && <ul className="mt-1 list-disc pl-5 font-normal">{missing.map((m) => <li key={m}>{m}</li>)}</ul>}
            </div>
          )}
          <Button className="mt-5" size="lg" onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : props.willPublishInstantly ? "Publish" : "Submit for review"}
          </Button>
          <p className="mt-2 text-[13px] text-navy/60">Save any changes to the details below before you submit.</p>
        </>
      )}
    </section>
  );
}
