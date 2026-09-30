export type UserRole = "client" | "agent" | "professional" | "admin";

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
  assigned_professional_id: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  case_id: string;
  name: string;
  sequence_order: number;
  status: MilestoneStatus;
  due_date: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  milestone_id: string;
  submitted_by: string;
  findings_summary: string;
  status_flag: ReportStatusFlag;
  geo_lat: number | null;
  geo_lng: number | null;
  visit_time: string;
  client_visible: boolean;
  created_at: string;
}

export interface MediaItem {
  id: string;
  report_id: string;
  storage_path: string;
  media_type: string;
  captured_at: string;
}

export interface DocumentRow {
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
}

export interface CaseMessage {
  id: string;
  case_id: string;
  sender_id: string;
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

export const REPORT_FLAG_COLORS: Record<ReportStatusFlag, string> = {
  confirmed_good: "bg-verified/10 text-verified border-verified/30",
  confirmed_issue: "bg-stamp/10 text-stamp border-stamp/30",
  unable_to_verify: "bg-amber-50 text-amber-700 border-amber-300",
  escalation_needed: "bg-red-50 text-red-700 border-red-400",
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
