"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";
import { OtpStep } from "./OtpStep";

type Mode = "login" | "verify" | "forgot" | "reset" | "reset-done";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const enter = () => { router.push("/dashboard"); router.refresh(); };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      if (err instanceof ApiError && err.data?.needsVerification) setMode("verify");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "verify") return <OtpStep email={email} onVerified={enter} />;

  if (mode === "login") {
    return (
      <form
        className="space-y-5" noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const addr = String(f.get("email") ?? "").trim().toLowerCase();
          setEmail(addr);
          run(async () => { await api("/api/operator/login", { body: { email: addr, password: String(f.get("password") ?? "") } }); enter(); });
        }}
      >
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="username" autoFocus /></Field>
        <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" required autoComplete="current-password" /></Field>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="font-semibold text-green-600 hover:underline" onClick={() => { setError(""); setMode("forgot"); }}>Forgot password?</button>
          <Link href="/partner/signup" className="font-semibold text-navy/70 hover:underline">New here? List your business</Link>
        </div>
      </form>
    );
  }

  if (mode === "forgot") {
    return (
      <form
        className="space-y-5" noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const addr = String(new FormData(e.currentTarget).get("email") ?? "").trim().toLowerCase();
          setEmail(addr);
          run(async () => { await api("/api/operator/forgot", { body: { email: addr } }); setMode("reset"); });
        }}
      >
        <p className="text-[15px] text-navy/80">Enter your email and we'll send a code to set a new password.</p>
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="username" autoFocus defaultValue={email} /></Field>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send code"}</Button>
        <button type="button" className="block w-full text-center text-sm font-semibold text-navy/70 hover:underline" onClick={() => setMode("login")}>Back to sign in</button>
      </form>
    );
  }

  if (mode === "reset") {
    return (
      <form
        className="space-y-5" noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => { await api("/api/operator/reset", { body: { email, otp: String(f.get("otp") ?? ""), password: String(f.get("password") ?? "") } }); setMode("reset-done"); });
        }}
      >
        <p className="text-[15px] text-navy/80">If <strong>{email}</strong> has an account, a 6-digit code is on its way.</p>
        <Field label="Code" htmlFor="otp"><Input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus className="text-center font-mono text-2xl tracking-[0.5em]" /></Field>
        <Field label="New password" htmlFor="password" hint="At least 8 characters. You'll be signed out on other devices."><Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Saving…" : "Set new password"}</Button>
      </form>
    );
  }

  return (
    <div className="space-y-5 text-center">
      <p role="status" className="text-[15px] text-navy/80">Your password is updated. Sign in with the new one.</p>
      <Button size="lg" className="w-full" onClick={() => { setError(""); setMode("login"); }}>Back to sign in</Button>
    </div>
  );
}
