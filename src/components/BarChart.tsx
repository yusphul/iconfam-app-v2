export default function BarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-neutral-500">{d.label}</span>
            <span className="font-semibold text-navy">{d.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line/70">
            <div
              className="h-full rounded-full bg-stamp transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {data.every((d) => d.value === 0) && (
        <p className="text-xs text-neutral-400">No data yet.</p>
      )}
    </div>
  );
}
