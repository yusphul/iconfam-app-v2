"use client";

import Image from "next/image";
import type { CaseType } from "@/lib/types";
import { CASE_TYPE_LABELS } from "@/lib/types";
import { CASE_TYPE_IMAGE } from "@/lib/caseVisuals";
import { CheckIcon } from "@/components/portal/icons";

// Four photo cards, one per kind of verification. A real radio group underneath,
// so it works with keyboard and screen readers.
export default function ServicePicker({
  value,
  onChange,
}: {
  value: CaseType;
  onChange: (v: CaseType) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-navy">What do you need verified?</legend>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(Object.entries(CASE_TYPE_LABELS) as [CaseType, string][]).map(([key, label]) => {
          const selected = value === key;
          return (
            <label
              key={key}
              className={`group relative block cursor-pointer overflow-hidden rounded-2xl border-2 bg-footerBg transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-stamp ${
                selected ? "border-stamp shadow-md" : "border-transparent hover:shadow-md"
              }`}
            >
              <input
                type="radio"
                name="case-type"
                value={key}
                checked={selected}
                onChange={() => onChange(key)}
                className="sr-only"
              />
              <div className="relative h-28 sm:h-32">
                <Image
                  src={CASE_TYPE_IMAGE[key].src}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 12rem, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-footerBg via-footerBg/50 to-transparent" />
                {selected && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-stamp text-white shadow">
                    <CheckIcon size={14} />
                  </span>
                )}
              </div>
              <span className="block px-3 pb-3 pt-1 text-sm font-semibold leading-snug text-white">
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
