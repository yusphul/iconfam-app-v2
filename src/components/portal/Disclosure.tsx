"use client";

import { useEffect, useState } from "react";

// Animated show/hide. The content stays out of the DOM until first opened, then
// folds with a height transition (grid-rows 0fr -> 1fr) and is made invisible
// when closed, so it can't be tabbed into or read out by a screen reader.
export default function Disclosure({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  // `shown` lags `open` by a frame on first mount so the grid-rows transition
  // has a closed state to animate from.
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [open]);
  if (!mounted) return null;
  return (
    <div
      className={`grid transition-[grid-template-rows,visibility] duration-300 ease-out motion-reduce:transition-none ${
        open && shown ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
