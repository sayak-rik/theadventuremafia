// Renders a JSON-LD <script> for structured data. Server-rendered into the
// initial HTML so crawlers read it without executing JS.
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
