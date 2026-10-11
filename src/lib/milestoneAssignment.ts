import type { Milestone } from "@/lib/types";

// A milestone with an assignee can only be worked by that person.
// With no assignee, anyone on the case team can work it.
export function canWorkMilestone(m: Pick<Milestone, "assigned_to">, userId: string | undefined): boolean {
  return !m.assigned_to || m.assigned_to === userId;
}

export function assigneeChip(m: Pick<Milestone, "assigned_to" | "assigned_label">, userId: string | undefined): string | null {
  if (!m.assigned_to) return null;
  return m.assigned_to === userId ? "Assigned to you" : `Assigned to ${m.assigned_label ?? "another team member"}`;
}
