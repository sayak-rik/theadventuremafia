import * as React from "react";
import { cn } from "@/lib/cn";

export const fieldClass =
  "block w-full rounded-lg border border-navy/20 bg-white px-3.5 text-[15px] text-navy placeholder:text-navy/40 outline-none transition focus:border-green focus:ring-2 focus:ring-green/30 disabled:bg-navy/5 aria-[invalid=true]:border-red-600";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldClass, "h-11", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(fieldClass, "py-2.5", className)} {...props} />;
});

/** Native <select>: best mobile UX and zero JS. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldClass, "h-11 appearance-none bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%230e1a24'%3E%3Cpath d='M5.5 7.5 10 12l4.5-4.5' stroke='%230e1a24' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")" }}
      {...props}>
      {children}
    </select>
  );
});

/** Label + control + hint + error, wired together for screen readers. */
export function Field({
  label, htmlFor, hint, error, children, className,
}: { label: string; htmlFor: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-navy">{label}</label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="mt-1.5 text-[13px] leading-snug text-navy/60">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-[13px] font-medium text-red-700">{error}</p>}
    </div>
  );
}

export function Checkbox({ label, hint, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; hint?: string }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border border-navy/15 bg-white p-3 has-[:checked]:border-green has-[:checked]:bg-green/5", className)}>
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-green" {...props} />
      <span className="text-[15px] leading-snug text-navy">
        {label}
        {hint && <span className="mt-0.5 block text-[13px] text-navy/60">{hint}</span>}
      </span>
    </label>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{children}</p>;
}

/** Card with a title inside it (a native <legend> straddles the border, which looks broken on rounded cards). */
export function FieldSet({ title, hint, children, gridClassName = "grid gap-5 sm:grid-cols-2" }: { title: string; hint?: string; children: React.ReactNode; gridClassName?: string }) {
  return (
    <fieldset className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
      <legend className="float-left mb-1 w-full font-serif text-lg font-bold text-navy">{title}</legend>
      {hint && <p className="clear-both mb-4 text-sm text-navy/65">{hint}</p>}
      <div className={cn("clear-both", !hint && "pt-3", gridClassName)}>{children}</div>
    </fieldset>
  );
}
