export default function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}
