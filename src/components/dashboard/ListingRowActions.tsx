"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client-api";

export function ListingRowActions({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setActive(active: boolean) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/operator/listings/${id}/active`, { body: { active } });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm" variant="outline"><Link href={`/dashboard/listings/${id}`}>Edit</Link></Button>
      {status === "published" && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setActive(false)}><Pause className="h-4 w-4" aria-hidden /> Pause</Button>
      )}
      {status === "deactivated" && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setActive(true)}><Play className="h-4 w-4" aria-hidden /> Resume</Button>
      )}
      {error && <p role="alert" className="w-full text-[13px] font-medium text-red-700">{error}</p>}
    </div>
  );
}
