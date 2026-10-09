export type UserRole = "client" | "agent" | "professional" | "admin";

export type ProfessionalSpecialty =
  | "lawyer"
  | "surveyor"
  | "architect"
  | "structural_engineer"
  | "quantity_surveyor"
  | "estate_valuer"
  | "town_planner"
  | "agronomist"
  | "other";

export type ReviewState = "pending" | "approved" | "rejected";

export type RecommendationVerdict =
  | "proceed"
  | "proceed_with_caution"
  | "do_not_proceed"
  | "inconclusive";

export type CaseType =
  | "property_purchase"
  | "ground_up_build"
  | "farm_oversight"
  | "status_verification";

export type CaseStatus =
  | "intake"
  | "scoped"
  | "in_progress"
  | "awaiting_client_payment"
  | "report_delivered"
  | "closed"
  | "on_hold";

export type MilestoneStatus = "pending" | "in_progress" | "confirmed" | "issue_found";

export type ReportStatusFlag =
  | "confirmed_good"
  | "confirmed_issue"
  | "unable_to_verify"
  | "escalation_needed";

export type PaymentStatus = "pending" | "paid" | "overdue" | "waived";

export interface AppUser {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_number: string | null;
  role: UserRole;
  specialty: ProfessionalSpecialty | null;
  country: string | null;
  region: string | null;
  active: boolean;
  created_at: string;
}

export interface Case {
  id: string;
  client_id: string;
  case_type: CaseType;
  status: CaseStatus;
  title: string;
  location_description: string | null;
  assigned_agent_id: string | null;
  site_address: string | null;
  site_lat: number | null;
  site_lng: number | null;
  site_radius_m: number;
  deposit_required: boolean;
  quote_total: number | null;
  quote_currency: string | null;
  quote_lines: { label: string; amount: number }[] | null;
  created_at: string;
  updated_at: string;
}

// A professional (lawyer, surveyor, ...) assigned to a case. A case can have
// several — one row each.
export interface CaseProfessional {
  id: string;
  case_id: string;
  professional_id: string;
  assigned_at: string;
}

// iConfam's own recommendation / summary for a case, written by the admin.
// Clients only ever receive it once `published` is true.
export interface CaseRecommendation {
  case_id: string;
  verdict: RecommendationVerdict;
  summary: string;
  next_steps: string | null;
  published: boolean;
  published_at: string | null;
  updated_at: string;
}

export interface Milestone {
  id: string;
  case_id: string;
  name: string;
  sequence_order: number;
  status: MilestoneStatus;
  due_date: string | null;
  // Who added it, as a role label ("Lawyer", "iConfam team") — never a name.
  created_by: string | null;
  owner_label: string | null;
  created_at: string;
}

// Fields shared by anything that goes through the admin review gate (reports
// and documents): nothing reaches another party until an admin approves it and
// chooses who it is shared with.
export interface Reviewable {
  review_status: ReviewState;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  share_with_client: boolean;
  share_with_team: boolean;
  author_label: string | null;
}

export interface Report extends Reviewable {
  id: string;
  milestone_id: string;
  submitted_by: string;
  findings_summary: string;
  status_flag: ReportStatusFlag;
  geo_lat: number | null;
  geo_lng: number | null;
  distance_m: number | null;
  visit_time: string;
  created_at: string;
}

export interface MediaItem {
  id: string;
  report_id: string;
  storage_path: string;
  media_type: string;
  capture_source: "live" | "device_camera" | "gallery" | "legacy";
  captured_at: string;
}

export interface DocumentRow extends Reviewable {
  id: string;
  case_id: string;
  doc_type: string;
  storage_path: string;
  uploaded_by: string | null;
  retention_note: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  case_id: string;
  description: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
  kind: PaymentKind;
  method: PaymentMethod | null;
  client_reference: string | null;
  reported_at: string | null;
  ngn_amount: number | null;
  fx_rate: number | null;
}

export type PaymentKind = "deposit" | "balance" | "milestone" | "other";
export type PaymentMethod = "card" | "bank_usd" | "bank_ngn" | "other";

export type LeadStage = "new" | "call_booked" | "call_done" | "converted" | "lost";

export interface Lead {
  id: string;
  token: string;
  client_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  service: CaseType;
  site_address: string | null;
  summary: string;
  details: string | null;
  stage: LeadStage;
  call_at: string | null;
  call_minutes: 30 | 60 | null;
  call_link: string | null;
  converted_case_id: string | null;
  created_at: string;
  updated_at: string;
}

export type IntakeProcessStage = "not_started" | "started" | "stuck" | "unsure";

export interface LeadIntake {
  lead_id: string;
  process_stage: IntakeProcessStage | null;
  documents_held: string | null;
  goal: string | null;
  deadline: string | null;
  notes: string | null;
}

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "Needs a call",
  call_booked: "Call booked",
  call_done: "Call done",
  converted: "Quoted",
  lost: "Closed",
};

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  deposit: "Initial deposit",
  balance: "Balance",
  milestone: "Milestone payment",
  other: "Payment",
};

export const INTAKE_PROCESS_LABELS: Record<IntakeProcessStage, string> = {
  not_started: "Brand new, nothing started",
  started: "Started, in progress",
  stuck: "Started, but stuck",
  unsure: "Not sure",
};

export interface CaseMessage {
  id: string;
  case_id: string;
  sender_id: string;
  // Whose private conversation with the admin team this belongs to — the
  // client for the client thread, or the professional/agent for theirs.
  thread_user_id: string;
  channel: string;
  body: string;
  sent_at: string;
}

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  property_purchase: "Property Purchase",
  ground_up_build: "Ground-Up Build",
  farm_oversight: "Farm / Agribusiness",
  status_verification: "Status Verification",
};

export const REPORT_FLAG_LABELS: Record<ReportStatusFlag, string> = {
  confirmed_good: "Confirmed Good",
  confirmed_issue: "Confirmed Issue",
  unable_to_verify: "Unable to Verify",
  escalation_needed: "Escalation Needed",
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  intake: "Intake",
  scoped: "Scoped",
  in_progress: "In Progress",
  awaiting_client_payment: "Awaiting Payment",
  report_delivered: "Report Delivered",
  closed: "Closed",
  on_hold: "On Hold",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  confirmed: "Confirmed",
  issue_found: "Issue Found",
};

export const SPECIALTY_LABELS: Record<ProfessionalSpecialty, string> = {
  lawyer: "Lawyer",
  surveyor: "Surveyor",
  architect: "Architect",
  structural_engineer: "Structural Engineer",
  quantity_surveyor: "Quantity Surveyor",
  estate_valuer: "Estate Valuer",
  town_planner: "Town Planner",
  agronomist: "Agronomist",
  other: "Other specialist",
};

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
};

export const VERDICT_LABELS: Record<RecommendationVerdict, string> = {
  proceed: "Proceed",
  proceed_with_caution: "Proceed with caution",
  do_not_proceed: "Do not proceed",
  inconclusive: "Inconclusive — more checks needed",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
  waived: "Waived",
};

/** What to call someone in the UI: "Lawyer", "Field agent", ... */
export function roleLabel(u: Pick<AppUser, "role" | "specialty">): string {
  if (u.role === "professional") {
    return u.specialty ? SPECIALTY_LABELS[u.specialty] : "Professional";
  }
  if (u.role === "agent") return "Field agent";
  if (u.role === "admin") return "Admin";
  return "Client";
}
