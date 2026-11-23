import { Link } from "@tanstack/react-router";
import { MapPin, Users } from "lucide-react";
import { ProblemStatusBadge } from "./status-badge";
import { formatDate } from "@/lib/format";
import type { ProblemStatus } from "@/lib/constants";

export type ProblemCardData = {
  reference_id: string;
  title: string;
  description: string;
  location: string | null;
  status: ProblemStatus;
  published_at: string | null;
  created_at: string;
  category: { name: string; slug: string } | null;
  solverCount: number;
};

export function ProblemCard({ problem }: { problem: ProblemCardData }) {
  return (
    <Link
      to="/problems/$referenceId"
      params={{ referenceId: problem.reference_id }}
      className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow text-primary">{problem.category?.name ?? "General"}</span>
        <ProblemStatusBadge status={problem.status} />
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug text-foreground group-hover:text-primary">{problem.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{problem.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-muted-foreground">
        {problem.location && (
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{problem.location}</span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {problem.solverCount} {problem.solverCount === 1 ? "solver" : "solvers"}
        </span>
        <span className="ml-auto font-mono">{formatDate(problem.published_at ?? problem.created_at)}</span>
      </div>
    </Link>
  );
}
