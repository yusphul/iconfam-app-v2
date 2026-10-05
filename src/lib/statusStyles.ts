import type {
  CaseStatus,
  MilestoneStatus,
  PaymentStatus,
  ReportStatusFlag,
  RecommendationVerdict,
  ReviewState,
  LeadStage,
} from "@/lib/types";
import {
  CASE_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  LEAD_STAGE_LABELS,
  REPORT_FLAG_LABELS,
  REVIEW_STATE_LABELS,
  VERDICT_LABELS,
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
  accent: string; // LEFT border colour only (pair with border-l-4)
  accentTop: string; // TOP border colour only (pair with border-t-4)
  tint: string; // gradient start for soft tinted panels (use with bg-gradient-to-br ... to-white)
  border: string; // soft outline colour for tinted panels
  text: string; // readable text/icon colour on white or a tint
}

const TONES = {
  grey: {
    badge: "border-slate-300 bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
    bar: "bg-slate-300",
    accent: "border-l-slate-300",
    accentTop: "border-t-slate-300",
    tint: "from-slate-50",
    border: "border-slate-200",
    text: "text-slate-600",
  },
  indigo: {
    badge: "border-indigo-300 bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
    bar: "bg-indigo-400",
    accent: "border-l-indigo-400",
    accentTop: "border-t-indigo-400",
    tint: "from-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
  },
  blue: {
    badge: "border-blue-300 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
    accent: "border-l-blue-500",
    accentTop: "border-t-blue-500",
    tint: "from-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
  amber: {
    badge: "border-amber-300 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
    bar: "bg-amber-400",
    accent: "border-l-amber-400",
    accentTop: "border-t-amber-400",
    tint: "from-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
  },
  green: {
    badge: "border-emerald-300 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    accent: "border-l-emerald-500",
    accentTop: "border-t-emerald-500",
    tint: "from-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  violet: {
    badge: "border-violet-300 bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
    bar: "bg-violet-400",
    accent: "border-l-violet-400",
    accentTop: "border-t-violet-400",
    tint: "from-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
  },
  red: {
    badge: "border-red-300 bg-red-50 text-red-700",
    dot: "bg-red-500",
    bar: "bg-red-500",
    accent: "border-l-red-500",
    accentTop: "border-t-red-500",
    tint: "from-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
  // The one status that should be impossible to miss.
  redSolid: {
    badge: "border-red-700 bg-red-600 text-white",
    dot: "bg-white",
    bar: "bg-red-600",
    accent: "border-l-red-600",
    accentTop: "border-t-red-600",
    tint: "from-red-50",
    border: "border-red-300",
    text: "text-red-700",
  },
} satisfies Record<string, Tone>;

export type StatusKind = "case" | "milestone" | "report" | "review" | "payment" | "verdict" | "lead";

const VERDICT_TONE: Record<RecommendationVerdict, Tone> = {
  proceed: TONES.green,
  proceed_with_caution: TONES.amber,
  do_not_proceed: TONES.redSolid,
  inconclusive: TONES.grey,
};

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

const LEAD_TONE: Record<LeadStage, Tone> = {
  new: TONES.amber,
  call_booked: TONES.blue,
  call_done: TONES.indigo,
  converted: TONES.green,
  lost: TONES.grey,
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
    case "verdict":
      return {
        ...(VERDICT_TONE[value as RecommendationVerdict] ?? TONES.grey),
        label: VERDICT_LABELS[value as RecommendationVerdict] ?? value,
      };
    case "lead":
      return {
        ...(LEAD_TONE[value as LeadStage] ?? TONES.grey),
        label: LEAD_STAGE_LABELS[value as LeadStage] ?? value,
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
