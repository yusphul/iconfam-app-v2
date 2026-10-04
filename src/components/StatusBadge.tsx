import { statusStyle, type StatusKind } from "@/lib/statusStyles";

export default function StatusBadge({
  kind,
  value,
  label,
  className = "",
}: {
  kind: StatusKind;
  value: string;
  /** Override the default label (e.g. "Awaiting review" -> "Needs your review"). */
  label?: string;
  className?: string;
}) {
  const s = statusStyle(kind, value);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
}
