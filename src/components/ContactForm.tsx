"use client";

import { useState } from "react";
import { motion } from "motion/react";

const field =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-navy outline-none transition focus:border-green";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-green/30 bg-white p-10 text-center shadow-luxe"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green text-2xl text-white">✓</div>
        <h3 className="mt-5 font-serif text-2xl font-bold text-navy">Message sent!</h3>
        <p className="mx-auto mt-3 max-w-md text-navy/70">
          Thanks, {form.name.split(" ")[0]}. We&rsquo;ve emailed you a confirmation and our crew will reply within one working day.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="mb-1 block text-sm font-semibold text-navy">Name</label>
          <input id="c-name" required value={form.name} onChange={set("name")} className={field} placeholder="Your name" />
        </div>
        <div>
          <label htmlFor="c-email" className="mb-1 block text-sm font-semibold text-navy">Email</label>
          <input id="c-email" type="email" required value={form.email} onChange={set("email")} className={field} placeholder="you@example.com" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-phone" className="mb-1 block text-sm font-semibold text-navy">Phone (optional)</label>
          <input id="c-phone" value={form.phone} onChange={set("phone")} className={field} placeholder="+91 98765 43210" />
        </div>
        <div>
          <label htmlFor="c-subject" className="mb-1 block text-sm font-semibold text-navy">Subject (optional)</label>
          <input id="c-subject" value={form.subject} onChange={set("subject")} className={field} placeholder="Group booking, dates…" />
        </div>
      </div>
      <div>
        <label htmlFor="c-message" className="mb-1 block text-sm font-semibold text-navy">Message</label>
        <textarea id="c-message" required rows={5} value={form.message} onChange={set("message")} className={field} placeholder="Tell us what you'd like to know…" />
      </div>

      {status === "error" && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-full bg-green px-6 py-4 text-sm font-semibold text-white shadow-luxe transition hover:bg-green-600 disabled:opacity-50 sm:w-auto sm:px-10"
      >
        {status === "submitting" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
