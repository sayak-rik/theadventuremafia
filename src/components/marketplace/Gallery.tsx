"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { CategoryIcon } from "./CategoryIcon";

type Img = { url: string; thumbUrl: string | null; width: number | null; height: number | null };

/** Big image + thumbnail strip. No library: a single piece of state. */
export function Gallery({ images, title, icon }: { images: Img[]; title: string; icon: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) {
    return <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-navy/5 text-navy/25"><CategoryIcon icon={icon} className="h-16 w-16" /></div>;
  }
  const main = images[i] ?? images[0];
  return (
    <div>
      <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-navy/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={main.url} alt={`${title}, photo ${i + 1} of ${images.length}`} width={main.width ?? 1200} height={main.height ?? 750}
          fetchPriority={i === 0 ? "high" : "auto"} className="h-full w-full object-cover" />
      </div>
      {images.length > 1 && (
        <ul className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1" aria-label="Photos">
          {images.map((img, idx) => (
            <li key={img.url} className="shrink-0 snap-start">
              <button type="button" onClick={() => setI(idx)} aria-label={`Show photo ${idx + 1}`} aria-current={idx === i}
                className={cn("block h-16 w-24 overflow-hidden rounded-lg border-2 bg-navy/5 transition", idx === i ? "border-green" : "border-transparent opacity-70 hover:opacity-100")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbUrl ?? img.url} alt="" width={96} height={64} loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
