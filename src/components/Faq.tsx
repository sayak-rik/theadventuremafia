/** Accordion of questions — plain <details>, no JS. */
export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-navy/10 border-y border-navy/10">
      {items.map(({ q, a }) => (
        <details key={q} className="group py-4">
          <summary className="cursor-pointer list-none font-semibold text-navy marker:hidden">
            <span className="flex items-start justify-between gap-4">{q}<span aria-hidden className="mt-0.5 text-navy/50 transition group-open:rotate-45">+</span></span>
          </summary>
          <p className="mt-3 max-w-prose leading-relaxed text-navy/75">{a}</p>
        </details>
      ))}
    </div>
  );
}
