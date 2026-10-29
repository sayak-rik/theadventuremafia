"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";
import { OtpStep } from "./OtpStep";
import type { CategoryOption, RegionOption } from "@/lib/taxonomy";

export function SignupForm({
  categories, regions, companyType = "operator",
}: { categories: CategoryOption[]; regions: RegionOption[]; companyType?: "operator" | "driver" }) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>(companyType === "driver" ? ["car-hire"] : []);
  const [email, setEmail] = useState("");
  const isDriver = companyType === "driver";
  const top = useRef<HTMLDivElement>(null);

  // The code step is much shorter than the form — bring it back into view.
  useEffect(() => {
    if (step === "verify") top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setFields({});
    const body = {
      businessName: String(f.get("businessName") ?? ""),
      ownerName: String(f.get("ownerName") ?? ""),
      email: String(f.get("email") ?? ""),
      phone: String(f.get("phone") ?? ""),
      password: String(f.get("password") ?? ""),
      categories: picked,
      regionSlug: String(f.get("regionSlug") ?? ""),
      address: String(f.get("address") ?? ""),
      acceptTerms: f.get("acceptTerms") === "on",
      companyType,
      website: String(f.get("website") ?? ""),
    };
    try {
      await api("/api/operator/signup", { body });
      setEmail(body.email.trim().toLowerCase());
      setStep("verify");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else setError("Couldn't create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "verify") {
    return (
      <div ref={top} className="scroll-mt-24">
        <OtpStep email={email} onVerified={() => { router.push("/dashboard"); router.refresh(); }} />
      </div>
    );
  }

  const toggle = (slug: string) => setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={isDriver ? "Your name or business name" : "Business name"} htmlFor="businessName" error={fields.businessName} className="sm:col-span-2">
          <Input id="businessName" name="businessName" required autoComplete="organization" placeholder={isDriver ? "e.g. Pemba's Taxi Service" : "e.g. Himal Bike Rentals"} aria-invalid={!!fields.businessName} />
        </Field>
        <Field label="Your name" htmlFor="ownerName" error={fields.ownerName}>
          <Input id="ownerName" name="ownerName" required autoComplete="name" aria-invalid={!!fields.ownerName} />
        </Field>
        <Field label="Mobile number" htmlFor="phone" hint="Customers and our team will call this number." error={fields.phone}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" required autoComplete="tel" placeholder="98765 43210" aria-invalid={!!fields.phone} />
        </Field>
        <Field label="Email" htmlFor="email" error={fields.email}>
          <Input id="email" name="email" type="email" required autoComplete="email" aria-invalid={!!fields.email} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters." error={fields.password}>
          <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={8} aria-invalid={!!fields.password} />
        </Field>
      </div>

      {!isDriver && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-navy">What do you offer?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {categories.map((c) => (
              <Checkbox key={c.slug} label={c.name} checked={picked.includes(c.slug)} onChange={() => toggle(c.slug)} />
            ))}
          </div>
          {fields.categories && <p role="alert" className="text-[13px] font-medium text-red-700">{fields.categories}</p>}
        </fieldset>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Where do you operate?" htmlFor="regionSlug" error={fields.regionSlug}>
          <Select id="regionSlug" name="regionSlug" defaultValue={regions[0]?.slug}>
            {regions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Shop or office address" htmlFor="address" hint="So we can find you when we verify." error={fields.address} className="sm:col-span-2">
          <Textarea id="address" name="address" rows={2} autoComplete="street-address" />
        </Field>
      </div>

      {/* Honeypot: invisible to people, tempting to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <Checkbox
        name="acceptTerms" required
        label={<>I agree to the <Link href="/partner/terms" target="_blank" className="font-semibold underline underline-offset-2">partner terms</Link>, including that customers pay me directly and The Adventure Mafia never holds their money.</>}
      />
      {fields.acceptTerms && <p role="alert" className="text-[13px] font-medium text-red-700">{fields.acceptTerms}</p>}

      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Creating your account…" : "Create account"}</Button>
      <p className="text-center text-sm text-navy/70">
        Already listed with us? <Link href="/dashboard/login" className="font-semibold text-green-600 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
