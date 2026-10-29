"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FormError, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";

export function AdminListingActions({
  id, status, companyApproved, isFeatured, featuredUntil,
}: { id: number; status: string; companyApproved: boolean; isFeatured: boolean; featuredUntil: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [featured, setFeatured] = useState(isFeatured);
  const [until, setUntil] = useState(featuredUntil ?? "");

  async function act(action: string, needsNote: boolean) {
    if (needsNote && !note.trim()) { setError("Write a short note so the operator knows why."); return; }
    setBusy(true); setError("");
    try {
      await api(`/api/admin/listings/${id}`, { body: { action, note: note || undefined } });
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveFeatured(next: boolean) {
    setBusy(true); setError("");
    try {
      await api(`/api/admin/listings/${id}/featured`, { method: "PUT", body: { isFeatured: next, featuredUntil: until || null } });
      setFeatured(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update.");
    } finally {
      setBusy(false);
    }
  }

  const reviewable = ["pending_review", "changes_requested", "rejected", "draft"].includes(status);
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="font-serif text-lg font-bold text-navy">Decision</h2>
        {!companyApproved && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-navy">This operator isn't approved yet, so nothing can go live. Approve them first.</p>}
        <Field label="Note to the operator" htmlFor="note" hint="Required for changes requested, reject and take down. Sent by email.">
          <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <FormError>{error}</FormError>
        <div className="flex flex-wrap gap-2">
          {reviewable && <Button disabled={busy || !companyApproved} onClick={() => act("publish", false)}>Publish</Button>}
          {status === "pending_review" && <Button variant="outline" disabled={busy} onClick={() => act("request_changes", true)}>Request changes</Button>}
          {["pending_review", "changes_requested", "published"].includes(status) && <Button variant="danger" disabled={busy} onClick={() => act("reject", true)}>Reject</Button>}
          {status === "published" && <Button variant="outline" disabled={busy} onClick={() => act("deactivate", true)}>Take down</Button>}
          {["deactivated", "rejected"].includes(status) && <Button variant="outline" disabled={busy || !companyApproved} onClick={() => act("reinstate", false)}>Reinstate</Button>}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="font-serif text-lg font-bold text-navy">Featured placement</h2>
        <p className="text-sm text-navy/60">Paid add-on (invoiced manually, same as the platform fee). Boosts this listing in search and on the homepage.</p>
        <Field label="Featured until (optional)" htmlFor="featuredUntil">
          <input id="featuredUntil" type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="h-10 w-full rounded-lg border border-navy/20 px-3 text-[15px]" />
        </Field>
        <Button variant={featured ? "outline" : "primary"} size="sm" disabled={busy} onClick={() => saveFeatured(!featured)}>
          {featured ? "Remove from featured" : "Make featured"}
        </Button>
      </section>
    </div>
  );
}
