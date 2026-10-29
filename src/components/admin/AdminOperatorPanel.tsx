"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";

type Verification = {
  businessType: string | null; tradeLicenceNo: string | null; address: string | null; mapsUrl: string | null;
  phoneVerifiedAt: string | null; visitedAt: string | null; documentsNote: string | null; adminNotes: string | null;
  drivingLicenceNumber: string | null; drivingLicenceExpiry: string | null;
} | null;

export function AdminOperatorPanel({ id, status, companyType, commissionPercent, isVerified, autoPublish, verification, hasPayment, hasLiveOrQueued }: {
  id: number; status: string; companyType: string; commissionPercent: number; isVerified: boolean; autoPublish: boolean;
  verification: Verification; hasPayment: boolean; hasLiveOrQueued: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const [commission, setCommission] = useState(String(commissionPercent));
  const isDriver = companyType === "driver";

  async function act(action: string, extra: { reason?: string; value?: boolean; percent?: number } = {}, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true); setError("");
    try {
      await api(`/api/admin/operators/${id}`, { body: { action, ...extra } });
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveVerification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    setBusy(true); setError(""); setSaved(false);
    try {
      await api(`/api/admin/operators/${id}/verification`, {
        method: "PUT",
        body: { businessType: g("businessType"), tradeLicenceNo: g("tradeLicenceNo"), address: g("address"), mapsUrl: g("mapsUrl"),
          phoneVerified: f.get("phoneVerified") === "on", visited: f.get("visited") === "on", documentsNote: g("documentsNote"), adminNotes: g("adminNotes"),
          drivingLicenceNumber: g("drivingLicenceNumber"), drivingLicenceExpiry: g("drivingLicenceExpiry") || null },
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="font-serif text-lg font-bold text-navy">Decision</h2>
        {status === "approved" && !hasPayment && <p className="mt-2 text-sm text-amber-800">This operator hasn't added payment details yet.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {(status === "pending" || status === "rejected") && (
            <Button disabled={busy} onClick={() => act("approve", {}, "Approve this operator? They'll be able to publish listings.")}>Approve</Button>
          )}
          {status === "suspended" && <Button disabled={busy} onClick={() => act("reinstate")}>Reinstate</Button>}
          {status === "rejected" && <Button variant="outline" disabled={busy} onClick={() => act("reinstate")}>Reinstate</Button>}
        </div>
        {(status === "pending" || status === "approved") && (
          <div className="mt-4 space-y-2">
            <Field label={status === "pending" ? "Reason (required to reject)" : "Reason (required to suspend)"} htmlFor="reason">
              <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shown to the operator in their email" />
            </Field>
            {status === "pending" && <Button variant="danger" disabled={busy} onClick={() => act("reject", { reason })}>Reject</Button>}
            {status === "approved" && (
              <Button variant="danger" disabled={busy}
                onClick={() => act("suspend", { reason }, hasLiveOrQueued ? "Suspending hides all their listings. Continue?" : undefined)}>Suspend</Button>
            )}
          </div>
        )}
        <FormError>{error}</FormError>
      </section>

      <section className="space-y-3 rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="font-serif text-lg font-bold text-navy">Trust</h2>
        <Checkbox label="Mafia Verified" hint="Shows a verified badge to customers. Only after you've really checked them." checked={isVerified} disabled={busy}
          onChange={(e) => act("set_verified", { value: e.target.checked })} />
        <Checkbox label="Publish their listings without review" hint="For operators you trust. Listings still need an approved account." checked={autoPublish} disabled={busy || status !== "approved"}
          onChange={(e) => act("set_auto_publish", { value: e.target.checked })} />
      </section>

      <section className="space-y-3 rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="font-serif text-lg font-bold text-navy">Commission</h2>
        <p className="text-sm text-navy/60">Inert for now — not collected, not shown to customers. Bookings stay free; this is groundwork for later.</p>
        <div className="flex items-center gap-3">
          <Field label="Commission %" htmlFor="commission" className="w-32">
            <Input id="commission" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
          </Field>
          <Button
            variant="outline" disabled={busy}
            onClick={() => { const n = Number(commission); if (Number.isFinite(n)) act("set_commission", { percent: n }); }}
          >
            Save
          </Button>
        </div>
      </section>

      <form onSubmit={saveVerification} className="space-y-4 rounded-2xl border border-navy/10 bg-white p-5" noValidate>
        <h2 className="font-serif text-lg font-bold text-navy">Verification checklist</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business type" htmlFor="businessType"><Input id="businessType" name="businessType" defaultValue={verification?.businessType ?? ""} placeholder="Sole proprietor, company…" /></Field>
          <Field label="Trade / rental licence no." htmlFor="tradeLicenceNo"><Input id="tradeLicenceNo" name="tradeLicenceNo" defaultValue={verification?.tradeLicenceNo ?? ""} /></Field>
          <Field label="Verified address" htmlFor="address" className="sm:col-span-2"><Input id="address" name="address" defaultValue={verification?.address ?? ""} /></Field>
          <Field label="Maps link" htmlFor="mapsUrl" className="sm:col-span-2"><Input id="mapsUrl" name="mapsUrl" defaultValue={verification?.mapsUrl ?? ""} /></Field>
          <Checkbox name="phoneVerified" label="Phone number verified by calling" defaultChecked={Boolean(verification?.phoneVerifiedAt)} />
          <Checkbox name="visited" label="Shop / base visited in person" defaultChecked={Boolean(verification?.visitedAt)} />
          {isDriver && (
            <>
              <Field label="Driving licence no." htmlFor="drivingLicenceNumber"><Input id="drivingLicenceNumber" name="drivingLicenceNumber" defaultValue={verification?.drivingLicenceNumber ?? ""} /></Field>
              <Field label="Licence expiry" htmlFor="drivingLicenceExpiry"><Input id="drivingLicenceExpiry" name="drivingLicenceExpiry" type="date" defaultValue={verification?.drivingLicenceExpiry ?? ""} /></Field>
            </>
          )}
          <Field label="Documents seen" htmlFor="documentsNote" hint={isDriver ? "e.g. driving licence & vehicle RC checked in person" : "e.g. trade licence, vehicle RC & insurance checked on a sample"} className="sm:col-span-2">
            <Textarea id="documentsNote" name="documentsNote" rows={2} defaultValue={verification?.documentsNote ?? ""} />
          </Field>
          <Field label="Internal notes" htmlFor="adminNotes" className="sm:col-span-2"><Textarea id="adminNotes" name="adminNotes" rows={3} defaultValue={verification?.adminNotes ?? ""} /></Field>
        </div>
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy}>Save checklist</Button>
          {saved && <p role="status" className="text-sm font-medium text-green-600">Saved.</p>}
        </div>
      </form>
    </div>
  );
}
