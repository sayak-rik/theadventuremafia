"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";
import type { RouteCatalogRow } from "@/lib/listings/routes";
import type { RegionOption } from "@/lib/taxonomy";

export function AdminRoutesPanel({ routes, regions }: { routes: RouteCatalogRow[]; regions: RegionOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle(id: number, isActive: boolean) {
    setBusy(true); setError("");
    try {
      await api(`/api/admin/routes/${id}`, { method: "PUT", body: { isActive } });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update.");
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => { const v = String(f.get(k) ?? "").trim(); return v ? Number(v) : null; };
    setBusy(true); setError("");
    try {
      await api("/api/admin/routes", {
        body: { originSlug: String(f.get("originSlug")), destinationSlug: String(f.get("destinationSlug")), distanceKm: num("distanceKm"), durationMinutes: num("durationMinutes") },
      });
      (e.currentTarget as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that route.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="grid gap-4 rounded-2xl border border-navy/10 bg-white p-5 sm:grid-cols-4">
        <Field label="From" htmlFor="originSlug"><Select id="originSlug" name="originSlug" defaultValue={regions[0]?.slug}>{regions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}</Select></Field>
        <Field label="To" htmlFor="destinationSlug"><Select id="destinationSlug" name="destinationSlug" defaultValue={regions[1]?.slug}>{regions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}</Select></Field>
        <Field label="Distance (km)" htmlFor="distanceKm"><Input id="distanceKm" name="distanceKm" inputMode="decimal" placeholder="e.g. 115" /></Field>
        <Field label="Duration (min)" htmlFor="durationMinutes"><Input id="durationMinutes" name="durationMinutes" inputMode="numeric" placeholder="e.g. 240" /></Field>
        <div className="sm:col-span-4"><Button type="submit" disabled={busy}>Add standardized route</Button></div>
      </form>
      <FormError>{error}</FormError>

      <ul className="divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/10 bg-white">
        {routes.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold text-navy">{r.originName} → {r.destinationName}</p>
              <p className="text-sm text-navy/60">
                {r.distanceKm ? `${r.distanceKm} km` : "distance not set"} · {r.durationMinutes ? `${r.durationMinutes} min` : "duration not set"} · {r.listingCount} listing{r.listingCount === 1 ? "" : "s"}
              </p>
            </div>
            <Button variant={r.isActive ? "outline" : "primary"} size="sm" disabled={busy} onClick={() => toggle(r.id, !r.isActive)}>
              {r.isActive ? "Deactivate" : "Activate"}
            </Button>
          </li>
        ))}
        {routes.length === 0 && <li className="p-6 text-center text-sm text-navy/60">No standardized routes yet.</li>}
      </ul>
    </div>
  );
}
