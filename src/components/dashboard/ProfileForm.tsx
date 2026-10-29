"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldSet, FormError, Input, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";
import type { CompanyProfile } from "@/lib/operators/account";
import type { CategoryOption, RegionOption } from "@/lib/taxonomy";

export function ProfileForm({ profile, categories, regions }: { profile: CompanyProfile; categories: CategoryOption[]; regions: RegionOption[] }) {
  const router = useRouter();
  const [cats, setCats] = useState(profile.categories);
  const [regs, setRegs] = useState(profile.regions);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const toggle = (list: string[], set: (v: string[]) => void, slug: string) => { setSaved(false); set(list.includes(slug) ? list.filter((x) => x !== slug) : [...list, slug]); };

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    setBusy(true); setError(""); setFields({}); setSaved(false);
    try {
      await api("/api/operator/company", {
        method: "PUT",
        body: {
          name: g("name"), description: g("description"), contactPhone: g("contactPhone"), whatsappNumber: g("whatsappNumber"),
          address: g("address"), mapsUrl: g("mapsUrl"), websiteUrl: g("websiteUrl"), instagramUrl: g("instagramUrl"), categories: cats, regions: regs,
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

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <div className="grid gap-5 rounded-2xl border border-navy/10 bg-white p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Business name" htmlFor="name" error={fields.name} className="sm:col-span-2"><Input id="name" name="name" defaultValue={profile.name} required /></Field>
        <Field label="About your business" htmlFor="description" hint="Shown on your public page." error={fields.description} className="sm:col-span-2">
          <Textarea id="description" name="description" rows={4} defaultValue={profile.description ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="contactPhone" error={fields.contactPhone}><Input id="contactPhone" name="contactPhone" type="tel" defaultValue={profile.contactPhone} required /></Field>
        <Field label="WhatsApp number" htmlFor="whatsappNumber" hint="Customers can message you here." error={fields.whatsappNumber}>
          <Input id="whatsappNumber" name="whatsappNumber" type="tel" defaultValue={profile.whatsappNumber ?? ""} />
        </Field>
        <Field label="Address" htmlFor="address" error={fields.address} className="sm:col-span-2"><Textarea id="address" name="address" rows={2} defaultValue={profile.address ?? ""} /></Field>
        <Field label="Google Maps link" htmlFor="mapsUrl" error={fields.mapsUrl}><Input id="mapsUrl" name="mapsUrl" type="url" defaultValue={profile.mapsUrl ?? ""} placeholder="https://maps.app.goo.gl/…" /></Field>
        <Field label="Website" htmlFor="websiteUrl" error={fields.websiteUrl}><Input id="websiteUrl" name="websiteUrl" type="url" defaultValue={profile.websiteUrl ?? ""} /></Field>
        <Field label="Instagram" htmlFor="instagramUrl" error={fields.instagramUrl} className="sm:col-span-2"><Input id="instagramUrl" name="instagramUrl" type="url" defaultValue={profile.instagramUrl ?? ""} /></Field>
      </div>

      <FieldSet title="What you offer" gridClassName="grid gap-2.5 sm:grid-cols-2">
        {categories.map((c) => <Checkbox key={c.slug} label={c.name} checked={cats.includes(c.slug)} onChange={() => toggle(cats, setCats, c.slug)} />)}
        {fields.categories && <p role="alert" className="text-[13px] font-medium text-red-700 sm:col-span-2">{fields.categories}</p>}
      </FieldSet>

      <FieldSet title="Where you operate" gridClassName="grid gap-2.5 sm:grid-cols-3">
        {regions.map((r) => <Checkbox key={r.slug} label={r.name} checked={regs.includes(r.slug)} onChange={() => toggle(regs, setRegs, r.slug)} />)}
        {fields.regions && <p role="alert" className="text-[13px] font-medium text-red-700 sm:col-span-3">{fields.regions}</p>}
      </FieldSet>

      <FormError>{error}</FormError>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
        {saved && <p role="status" className="text-sm font-medium text-green-600">Saved.</p>}
      </div>
    </form>
  );
}
