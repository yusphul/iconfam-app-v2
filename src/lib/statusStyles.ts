import type {
  CaseStatus,
  MilestoneStatus,
  PaymentStatus,
  ReportStatusFlag,
  ReviewState,
} from "@/lib/types";
import {
  CASE_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  REPORT_FLAG_LABELS,
  REVIEW_STATE_LABELS,
} from "@/lib/types";

// One colour language for every status in the app, shared by the client,
// field agent, professional and admin screens, so the same colour always means
// the same thing:
//
//   grey    = not started / informational
//   indigo  = scoped / agreed
//   blue    = work in progress
//   amber   = needs attention or someone's action (waiting on payment/review)
//   green   = good / done / approved
//   violet  = paused
//   red     = problem / rejected / overdue
//
// Colour is never the only signal — every badge also carries its text label
// and a dot — so it still reads for colour-blind users.
//
// NOTE: every class below is written out in full on purpose (Tailwind only
// generates classes it can find as literal strings), and tailwind.config.ts
// includes src/lib so this file is scanned.

export interface Tone {
  badge: string; // pill: background + text + border
  dot: string; // the small leading dot
  bar: string; // solid fill, e.g. timeline segments
  accent: string; // left/top border colour for cards and columns
}

const TONES = {
  grey: {
    badge: "border-slate-300 bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
    bar: "bg-slate-300",
    accent: "border-slate-300",
  },
  indigo: {
    badge: "border-indigo-300 bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
    bar: "bg-indigo-400",
    accent: "border-indigo-400",
  },
  blue: {
    badge: "border-blue-300 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
    accent: "border-blue-500",
  },
  amber: {
    badge: "border-amber-300 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
    bar: "bg-amber-400",
    accent: "border-amber-400",
  },
  green: {
    badge: "border-emerald-300 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    accent: "border-emerald-500",
  },
  violet: {
    badge: "border-violet-300 bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
    bar: "bg-violet-400",
    accent: "border-violet-400",
  },
  red: {
    badge: "border-red-300 bg-red-50 text-red-700",
    dot: "bg-red-500",
    bar: "bg-red-500",
    accent: "border-red-500",
  },
  // The one status that should be impossible to miss.
  redSolid: {
    badge: "border-red-700 bg-red-600 text-white",
    dot: "bg-white",
    bar: "bg-red-600",
    accent: "border-red-600",
  },
} satisfies Record<string, Tone>;

export type StatusKind = "case" | "milestone" | "report" | "review" | "payment";

const CASE_TONE: Record<CaseStatus, Tone> = {
  intake: TONES.grey,
  scoped: TONES.indigo,
  in_progress: TONES.blue,
  awaiting_client_payment: TONES.amber,
  report_delivered: TONES.green,
  closed: TONES.grey,
  on_hold: TONES.violet,
};

const MILESTONE_TONE: Record<MilestoneStatus, Tone> = {
  pending: TONES.grey,
  in_progress: TONES.blue,
  confirmed: TONES.green,
  issue_found: TONES.red,
};

const REPORT_TONE: Record<ReportStatusFlag, Tone> = {
  confirmed_good: TONES.green,
  confirmed_issue: TONES.red,
  unable_to_verify: TONES.amber,
  escalation_needed: TONES.redSolid,
};

const REVIEW_TONE: Record<ReviewState, Tone> = {
  pending: TONES.amber,
  approved: TONES.green,
  rejected: TONES.red,
};

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  pending: TONES.amber,
  paid: TONES.green,
  overdue: TONES.red,
  waived: TONES.grey,
};

export function statusStyle(kind: StatusKind, value: string): Tone & { label: string } {
  switch (kind) {
    case "case":
      return {
        ...(CASE_TONE[value as CaseStatus] ?? TONES.grey),
        label: CASE_STATUS_LABELS[value as CaseStatus] ?? value,
      };
    case "milestone":
      return {
        ...(MILESTONE_TONE[value as MilestoneStatus] ?? TONES.grey),
        label: MILESTONE_STATUS_LABELS[value as MilestoneStatus] ?? value,
      };
    case "report":
      return {
        ...(REPORT_TONE[value as ReportStatusFlag] ?? TONES.grey),
        label: REPORT_FLAG_LABELS[value as ReportStatusFlag] ?? value,
      };
    case "review":
      return {
        ...(REVIEW_TONE[value as ReviewState] ?? TONES.grey),
        label: REVIEW_STATE_LABELS[value as ReviewState] ?? value,
      };
    case "payment":
      return {
        ...(PAYMENT_TONE[value as PaymentStatus] ?? TONES.grey),
        label: PAYMENT_STATUS_LABELS[value as PaymentStatus] ?? value,
      };
  }
}

// Neutral chip for roles / specialties / "added by" labels — deliberately not
// one of the status colours so it never reads as a status.
export const LABEL_CHIP =
  "inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600";
