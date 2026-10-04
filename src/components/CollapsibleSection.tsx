"use client";

import { useState } from "react";

// A card whose body can be folded away. The header is a real button
// (aria-expanded), so it works with keyboard and screen readers.
export default function CollapsibleSection({
  title,
  summary,
  defaultOpen = true,
  actions,
  children,
}: {
  title: string;
  /** Short text shown next to the title, e.g. "2 of 5 steps complete". */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  /** Extra controls on the right of the header (e.g. expand all). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-line bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {title}
          </h2>
          {summary && <span className="truncate text-xs text-neutral-400">{summary}</span>}
        </button>
        {open && actions}
      </div>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      className={`shrink-0 text-neutral-400 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
