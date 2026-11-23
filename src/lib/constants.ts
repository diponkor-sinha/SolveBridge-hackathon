export const SOLUTION_TYPES = [
  { value: "SOFTWARE", label: "Software / App" },
  { value: "HARDWARE", label: "Hardware / Device" },
  { value: "RESEARCH", label: "Research / Study" },
  { value: "DESIGN", label: "Design / Concept" },
  { value: "PROCESS", label: "Process / Policy" },
  { value: "OTHER", label: "Other" },
] as const;

export type SolutionType = (typeof SOLUTION_TYPES)[number]["value"];
export type ProblemStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "RESOLVED" | "ARCHIVED";
export type SolutionStatus = "SUBMITTED" | "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED";

export const PROBLEM_STATUS_LABEL: Record<ProblemStatus, string> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Open",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
  ARCHIVED: "Archived",
};

export const SOLUTION_STATUS_LABEL: Record<SolutionStatus, string> = {
  SUBMITTED: "Under review",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  CHANGES_REQUESTED: "Changes requested",
};

export function solutionTypeLabel(value: string) {
  return SOLUTION_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Upload rules shared by the browser (early feedback) and the server (enforcement). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES_PER_SUBMISSION = 3;
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const ALLOWED_UPLOAD_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf";

export const PAGE_SIZE = 12;
