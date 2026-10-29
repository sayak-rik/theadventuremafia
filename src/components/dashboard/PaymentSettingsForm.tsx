"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";

type Initial = { payeeName: string; upiVpa: string | null; upiNumber: string | null; qrImageUrl: string | null } | null;

export function PaymentSettingsForm({ initial, companyName }: { initial: Initial; companyName: string }) {
  const router = useRouter();
  const hasExisting = Boolean(initial && (initial.upiVpa || initial.upiNumber || initial.qrImageUrl));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const qrInput = useRef<HTMLInputElement>(null);
  const [qrPassword, setQrPassword] = useState("");
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState("");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(""); setFields({}); setSaved(false);
    try {
      await api("/api/operator/payment-settings", {
        method: "PUT",
        body: {
          payeeName: String(f.get("payeeName") ?? ""), upiVpa: String(f.get("upiVpa") ?? ""), upiNumber: String(f.get("upiNumber") ?? ""),
          currentPassword: String(f.get("currentPassword") ?? "") || undefined,
        },
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) { setError(err.message); setFields(err.fields ?? {}); } else setError("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadQr(file: File | undefined) {
    if (!file) return;
    setQrBusy(true); setQrError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("password", qrPassword);
      await api("/api/operator/payment-qr", { body: form });
      setQrPassword("");
      router.refresh();
    } catch (err) {
      setQrError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setQrBusy(false);
      if (qrInput.current) qrInput.current.value = "";
    }
  }

  async function removeQr() {
    if (!confirm("Remove your QR image?")) return;
    setQrBusy(true); setQrError("");
    try {
      await api("/api/operator/payment-qr", { method: "DELETE", body: { password: qrPassword || undefined } });
      setQrPassword("");
      router.refresh();
    } catch (err) {
      setQrError(err instanceof ApiError ? err.message : "Couldn't remove it.");
    } finally {
      setQrBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-5 rounded-2xl border border-navy/10 bg-white p-5 sm:p-6" noValidate>
        <h2 className="font-serif text-xl font-bold text-navy">UPI details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name on your UPI account" htmlFor="payeeName" hint="Customers are told to check this name before paying." error={fields.payeeName} className="sm:col-span-2">
            <Input id="payeeName" name="payeeName" defaultValue={initial?.payeeName ?? companyName} required />
          </Field>
          <Field label="UPI ID" htmlFor="upiVpa" hint="Like name@okaxis. Needed for the pay-now button and QR." error={fields.upiVpa}>
            <Input id="upiVpa" name="upiVpa" defaultValue={initial?.upiVpa ?? ""} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="yourname@bank" />
          </Field>
          <Field label="UPI number (optional)" htmlFor="upiNumber" hint="Shown to customers who pay by typing a number." error={fields.upiNumber}>
            <Input id="upiNumber" name="upiNumber" inputMode="tel" defaultValue={initial?.upiNumber ?? ""} placeholder="98765 43210" />
          </Field>
          {hasExisting && (
            <Field label="Your password" htmlFor="currentPassword" hint="Needed to change where customers pay you." error={fields.currentPassword} className="sm:col-span-2">
              <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
            </Field>
          )}
        </div>
        <FormError>{error}</FormError>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={busy}>{busy ? "Saving…" : "Save payment details"}</Button>
          {saved && <p role="status" className="text-sm font-medium text-green-600">Saved.</p>}
        </div>
      </form>

      <section className="space-y-4 rounded-2xl border border-navy/10 bg-white p-5 sm:p-6" aria-labelledby="qr">
        <div>
          <h2 id="qr" className="font-serif text-xl font-bold text-navy">Your own QR code (optional)</h2>
          <p className="mt-1 text-sm text-navy/70">If you'd rather use the QR from your bank or UPI app, upload a screenshot. Customers will scan it and type in the amount shown.</p>
        </div>
        {initial?.qrImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initial.qrImageUrl} alt="Your payment QR code" width={160} height={160} className="h-40 w-40 rounded-lg border border-navy/10 bg-white object-contain" />
        )}
        {hasExisting && (
          <Field label="Your password" htmlFor="qrPassword" hint="Needed to change the QR.">
            <Input id="qrPassword" type="password" value={qrPassword} onChange={(e) => setQrPassword(e.target.value)} autoComplete="current-password" className="max-w-xs" />
          </Field>
        )}
        <FormError>{qrError}</FormError>
        <div className="flex flex-wrap gap-3">
          <input ref={qrInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => uploadQr(e.target.files?.[0])} />
          <Button type="button" variant="outline" disabled={qrBusy} onClick={() => qrInput.current?.click()}>{qrBusy ? "Working…" : initial?.qrImageUrl ? "Replace QR" : "Upload QR"}</Button>
          {initial?.qrImageUrl && <Button type="button" variant="ghost" disabled={qrBusy} onClick={removeQr}>Remove</Button>}
        </div>
      </section>
    </div>
  );
}
