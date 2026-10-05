import type { CaseType } from "@/lib/types";

// The site already has real photography for each kind of verification. The
// portal uses it as the identity of a case, instead of a generic card.
export const CASE_TYPE_IMAGE: Record<CaseType, { src: string; alt: string }> = {
  property_purchase: {
    src: "/wwd-land-verification.jpg",
    alt: "A surveyor checking plot boundaries on a tablet beside a theodolite",
  },
  ground_up_build: {
    src: "/wwd-site-inspection.jpg",
    alt: "Two inspectors reviewing building plans on a construction site",
  },
  farm_oversight: {
    src: "/wwd-farm.jpg",
    alt: "A farm manager reviewing crop data on a tablet in a field",
  },
  status_verification: {
    src: "/wwd-documentation.jpg",
    alt: "A lawyer reviewing a title deed and survey plan",
  },
};

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function firstName(full: string | null | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

export function initials(full: string | null | undefined): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
