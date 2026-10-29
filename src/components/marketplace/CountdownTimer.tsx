"use client";

import { useEffect, useState } from "react";

/** mm:ss until `until`. Calls onDone once at zero. */
export function CountdownTimer({ until, onDone }: { until: string; onDone?: () => void }) {
  const end = new Date(until).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const next = Math.max(0, end - Date.now());
      setLeft(next);
      if (next === 0) { clearInterval(t); onDone?.(); }
    }, 1000);
    return () => clearInterval(t);
  }, [end, onDone]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span role="timer" aria-live="off" className="tabular-nums">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
