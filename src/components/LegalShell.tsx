import type { ReactNode } from "react";

// Shared layout + readable typography for legal pages (Terms, Privacy).
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-4xl font-bold text-navy">{title}</h1>
      <p className="mt-2 text-sm text-navy/50">Last updated: {updated}</p>
      <div className="mt-8 space-y-6 leading-relaxed text-navy/80 [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-navy [&_li]:ml-5 [&_li]:list-disc [&_p]:text-[15px]">
        {children}
      </div>
    </article>
  );
}
