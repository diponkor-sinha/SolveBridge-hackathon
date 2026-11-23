import type { ProblemStatus, SolutionStatus } from "./constants";

/** Moderation rules shared by the admin server functions, the admin UI and tests. */

export type ProblemAction = "approve" | "reject" | "resolve" | "archive";
export type SolutionAction = "accept" | "reject" | "request_changes";

const PROBLEM_RULES: Record<ProblemAction, { to: ProblemStatus; from: ProblemStatus[] }> = {
  approve: { to: "APPROVED", from: ["PENDING_REVIEW", "REJECTED", "ARCHIVED", "RESOLVED"] },
  reject: { to: "REJECTED", from: ["PENDING_REVIEW", "APPROVED"] },
  resolve: { to: "RESOLVED", from: ["APPROVED"] },
  archive: { to: "ARCHIVED", from: ["APPROVED", "RESOLVED", "REJECTED"] },
};

const SOLUTION_RULES: Record<SolutionAction, { to: SolutionStatus; from: SolutionStatus[] }> = {
  accept: { to: "ACCEPTED", from: ["SUBMITTED"] },
  reject: { to: "REJECTED", from: ["SUBMITTED", "CHANGES_REQUESTED", "ACCEPTED"] },
  request_changes: { to: "CHANGES_REQUESTED", from: ["SUBMITTED"] },
};

/** Returns the new status, or null when the action is not allowed from the current status. */
export function nextProblemStatus(current: ProblemStatus, action: ProblemAction): ProblemStatus | null {
  const rule = PROBLEM_RULES[action];
  return rule.from.includes(current) ? rule.to : null;
}

export function allowedProblemActions(current: ProblemStatus): ProblemAction[] {
  return (Object.keys(PROBLEM_RULES) as ProblemAction[]).filter((a) => nextProblemStatus(current, a));
}

export function nextSolutionStatus(current: SolutionStatus, action: SolutionAction): SolutionStatus | null {
  const rule = SOLUTION_RULES[action];
  return rule.from.includes(current) ? rule.to : null;
}

export function allowedSolutionActions(current: SolutionStatus): SolutionAction[] {
  return (Object.keys(SOLUTION_RULES) as SolutionAction[]).filter((a) => nextSolutionStatus(current, a));
}

/** Rejecting or asking for changes must tell the solver why. */
export function solutionFeedbackRequired(action: SolutionAction) {
  return action !== "accept";
}

/** Only published problems can have publicly accepted solutions. */
export function problemAcceptsSolutions(status: ProblemStatus) {
  return status === "APPROVED" || status === "RESOLVED";
}

/** Problems visible in the public directory. Pending, rejected and archived never are. */
export function isPubliclyVisible(status: ProblemStatus) {
  return status === "APPROVED" || status === "RESOLVED";
}

export const PROBLEM_ACTION_LABEL: Record<ProblemAction, string> = {
  approve: "Approve & publish",
  reject: "Reject",
  resolve: "Mark resolved",
  archive: "Archive",
};

export const SOLUTION_ACTION_LABEL: Record<SolutionAction, string> = {
  accept: "Accept & publish",
  reject: "Reject",
  request_changes: "Request changes",
};
