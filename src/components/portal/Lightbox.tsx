"use client";

import { useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@/components/portal/icons";

export interface LightboxImage {
  url: string;
  alt: string;
}

// Full-screen photo viewer for report evidence. Keyboard: Esc closes, arrow
// keys move between photos. Focus goes to the close button on open and the
// page behind stops scrolling.
export default function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = images.length;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && count > 1) onIndex((index + 1) % count);
      if (e.key === "ArrowLeft" && count > 1) onIndex((index - 1 + count) % count);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, onIndex, onClose]);

  const current = images[index];
  if (!current) return null;

  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-footerBg/95 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button ref={closeRef} onClick={onClose} aria-label="Close photo viewer" className={`${btn} absolute right-4 top-4`}>
        <XIcon size={20} />
      </button>
      {count > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index - 1 + count) % count);
            }}
            aria-label="Previous photo"
            className={`${btn} absolute left-3 top-1/2 -translate-y-1/2 sm:left-6`}
          >
            <ChevronLeftIcon size={22} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index + 1) % count);
            }}
            aria-label="Next photo"
            className={`${btn} absolute right-3 top-1/2 -translate-y-1/2 sm:right-6`}
          >
            <ChevronRightIcon size={22} />
          </button>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
      />
      {count > 1 && (
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          {index + 1} of {count}
        </p>
      )}
    </div>
  );
}
