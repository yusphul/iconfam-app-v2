import type { Milestone } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-line",
  in_progress: "bg-stamp/50",
  confirmed: "bg-verified",
  issue_found: "bg-red-400",
};

const LEGEND: { key: string; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "confirmed", label: "Confirmed" },
  { key: "issue_found", label: "Issue found" },
];

export default function MilestoneGantt({
  rows,
}: {
  rows: { caseId: string; caseTitle: string; milestones: Milestone[] }[];
}) {
  return (
    <div>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.caseId}>
            <div className="mb-1.5 truncate text-xs font-medium text-navy">
              {row.caseTitle}
            </div>
            {row.milestones.length === 0 ? (
              <div className="h-3 rounded-sm bg-line/50" />
            ) : (
              <div className="flex gap-1">
                {row.milestones.map((m) => (
                  <div
                    key={m.id}
                    title={`${m.name} — ${m.status.replace("_", " ")}`}
                    className={`h-3 flex-1 rounded-sm ${STATUS_STYLE[m.status] ?? "bg-line"}`}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-neutral-400">No active cases yet.</p>}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3">
        {LEGEND.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_STYLE[l.key]}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
