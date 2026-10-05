"use client";

import { useState } from "react";
import Disclosure from "@/components/portal/Disclosure";

// A card whose body folds away with a short height transition. The header is a
// real button (aria-expanded), so it works with keyboard and screen readers.
export default function CollapsibleSection({
  title,
  summary,
  defaultOpen = true,
  actions,
  children,
}: {
  title: string;
  /** Short text shown next to the title, e.g. "5 steps". */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  /** Extra controls on the right of the header (e.g. expand all). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stamp"
        >
          <Chevron open={open} />
          <h2 className="font-display text-lg font-semibold text-navy">{title}</h2>
          {summary && <span className="hidden truncate text-sm text-neutral-400 sm:inline">{summary}</span>}
        </button>
        {open && actions}
      </div>
      <Disclosure open={open}>
        <div className="border-t border-line p-5">{children}</div>
      </Disclosure>
    </section>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      className={`shrink-0 text-neutral-400 transition-transform duration-300 motion-reduce:transition-none ${
        open ? "rotate-90" : ""
      }`}
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
