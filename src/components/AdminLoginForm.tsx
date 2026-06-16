"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const field =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-navy outline-none transition focus:border-green";

export function AdminLoginForm() {
  const router = useRouter();
  // Username is always "admin".
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed.");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-semibold text-navy">Username</label>
        <input id="username" value="admin" readOnly className={`${field} bg-cream/60`} aria-readonly />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold text-navy">Password</label>
        <input
          id="password"
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
          placeholder="••••••••"
        />
      </div>
      {status === "error" && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-full bg-green px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
      >
        {status === "submitting" ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
