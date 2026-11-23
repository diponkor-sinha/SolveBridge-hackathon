import { Badge } from "@/components/ui/badge";
import { PROBLEM_STATUS_LABEL, SOLUTION_STATUS_LABEL, type ProblemStatus, type SolutionStatus } from "@/lib/constants";

const PROBLEM_VARIANT = {
  PENDING_REVIEW: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  RESOLVED: "success",
  ARCHIVED: "muted",
} as const;

const SOLUTION_VARIANT = {
  SUBMITTED: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warning",
} as const;

export function ProblemStatusBadge({ status }: { status: ProblemStatus }) {
  return <Badge variant={PROBLEM_VARIANT[status]}>{PROBLEM_STATUS_LABEL[status]}</Badge>;
}

export function SolutionStatusBadge({ status }: { status: SolutionStatus }) {
  return <Badge variant={SOLUTION_VARIANT[status]}>{SOLUTION_STATUS_LABEL[status]}</Badge>;
}
