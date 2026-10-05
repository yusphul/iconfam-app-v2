"use client";

import { useEffect, useState } from "react";

// A single-measure progress ring. It draws in once when it mounts (the one
// orchestrated moment on the case page) and shows the exact figure in the
// middle, so the shape is never the only carrier of the number.
export default function ProgressRing({
  value,
  max,
  size = 112,
  stroke = 9,
  trackClassName = "text-white/20",
  barClassName = "text-verified",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  trackClassName?: string;
  barClassName?: string;
  children?: React.ReactNode;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = max > 0 ? Math.min(1, value / max) : 0;
  const offset = c * (1 - (drawn ? fraction : 0));

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} of ${max} verified`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={`${barClassName} transition-[stroke-dashoffset] duration-[1100ms] ease-out motion-reduce:transition-none`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
