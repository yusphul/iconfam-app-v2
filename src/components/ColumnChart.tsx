"use client";

import { useState } from "react";

// One-series column chart in plain SVG: thin rounded bars on a quiet grid,
// a hover/focus tooltip, a label on the tallest bar, and a table view for
// anyone who prefers numbers (or can't see colour).

export interface Column {
  label: string;
  value: number;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const W = 720;
const H = 240;
const M = { top: 16, right: 12, bottom: 28, left: 56 };

export default function ColumnChart({
  data,
  format,
  axisFormat,
  ariaLabel,
  valueHeader = "Amount",
}: {
  data: Column[];
  format: (n: number) => string;
  /** shorter format for the y-axis ticks (defaults to `format`) */
  axisFormat?: (n: number) => string;
  ariaLabel: string;
  valueHeader?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const slot = iw / Math.max(1, data.length);
  const bw = Math.min(28, slot * 0.55);
  const top = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? 0) ? i : best), 0);
  const empty = data.every((d) => d.value === 0);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          className="text-xs font-medium text-stamp hover:underline"
        >
          {table ? "Show chart" : "Show as table"}
        </button>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-1 font-medium">Month</th>
              <th className="py-1 text-right font-medium">{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-line">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="w-full">
            {ticks.map((t) => {
              const y = M.top + ih - ih * t;
              return (
                <g key={t}>
                  <line x1={M.left} x2={W - M.right} y1={y} y2={y} stroke="#E4E9EF" strokeWidth="1" />
                  <text x={M.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748B">
                    {(axisFormat ?? format)(max * t)}
                  </text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const h = (d.value / max) * ih;
              const x = M.left + slot * i + (slot - bw) / 2;
              const y = M.top + ih - h;
              const r = Math.min(4, bw / 2, h);
              return (
                <g key={d.label}>
                  {d.value > 0 && (
                    <path
                      d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + h} Z`}
                      fill="#E8622C"
                      opacity={active === null || active === i ? 1 : 0.45}
                    />
                  )}
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748B">
                    {d.label}
                  </text>
                  {!empty && i === top && d.value > 0 && (
                    <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#101828">
                      {format(d.value)}
                    </text>
                  )}
                  <rect
                    x={M.left + slot * i}
                    y={M.top}
                    width={slot}
                    height={ih + 20}
                    fill="transparent"
                    tabIndex={0}
                    style={{ outline: "none" }}
                    aria-label={`${d.label}: ${format(d.value)}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  />
                </g>
              );
            })}
          </svg>
          {active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded border border-line bg-white px-2 py-1 text-xs shadow"
              style={{ left: `${((M.left + slot * active + slot / 2) / W) * 100}%` }}
            >
              <span className="text-neutral-500">{data[active].label}</span>{" "}
              <span className="font-semibold text-navy">{format(data[active].value)}</span>
            </div>
          )}
          {empty && <p className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">No income recorded in this period.</p>}
        </div>
      )}
    </div>
  );
}
