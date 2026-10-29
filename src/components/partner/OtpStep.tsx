"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";

/** "Enter the 6-digit code we emailed you" step, with a resend cooldown. */
export function OtpStep({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(45);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/operator/verify", { body: { email, otp: code } });
      onVerified();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't verify that code.");
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    setResent(false);
    try {
      await api("/api/operator/resend-otp", { body: { email } });
      setResent(true);
      setCooldown(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send a new code.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <p className="text-[15px] leading-relaxed text-navy/80">
        We sent a 6-digit code to <strong className="text-navy">{email}</strong>. It's valid for 10 minutes.
      </p>
      <Field label="Verification code" htmlFor="otp">
        <Input
          id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="text-center font-mono text-2xl tracking-[0.5em]" placeholder="••••••"
        />
      </Field>
      <FormError>{error}</FormError>
      {resent && !error && <p role="status" className="text-sm text-green-600">New code sent.</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : "Verify and continue"}
      </Button>
      <p className="text-center text-sm text-navy/70">
        Didn't get it?{" "}
        <button type="button" onClick={resend} disabled={cooldown > 0} className="font-semibold text-green-600 underline-offset-2 hover:underline disabled:text-navy/40 disabled:no-underline">
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
        </button>
      </p>
    </form>
  );
}
