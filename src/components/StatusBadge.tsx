import { statusStyle, type StatusKind } from "@/lib/statusStyles";

export default function StatusBadge({
  kind,
  value,
  label,
  variant = "soft",
  className = "",
}: {
  kind: StatusKind;
  value: string;
  /** Override the default label (e.g. "Awaiting review" -> "Needs your review"). */
  label?: string;
  /** "glass" is a frosted pill for sitting on top of photos. */
  variant?: "soft" | "glass";
  className?: string;
}) {
  const s = statusStyle(kind, value);
  const shell =
    variant === "glass"
      ? "border-white/30 bg-white/15 text-white shadow-sm backdrop-blur-md"
      : s.badge;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${shell} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${variant === "glass" ? "bg-white" : s.dot}`}
        aria-hidden="true"
      />
      {label ?? s.label}
    </span>
  );
}
