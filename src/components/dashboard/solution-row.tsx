import { Link } from "@tanstack/react-router";
import { SolutionStatusBadge } from "@/components/site/status-badge";
import { solutionTypeLabel, type SolutionStatus } from "@/lib/constants";
import { timeAgo } from "@/lib/format";

export type MySolution = {
  id: string;
  title: string;
  solution_type: string;
  status: SolutionStatus;
  admin_feedback: string | null;
  updated_at: string;
  problem: { reference_id: string; title: string } | null;
};

export function SolutionRow({ s }: { s: MySolution }) {
  return (
    <Link
      to="/dashboard/solutions/$solutionId"
      params={{ solutionId: s.id }}
      className="block rounded-xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-lift"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{s.title}</h3>
        <SolutionStatusBadge status={s["status"]} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        For {s.problem?.title ?? "a problem"} · {solutionTypeLabel(s.solution_type)} · updated {timeAgo(s.updated_at)}
      </p>
      {s.admin_feedback && (s["status"] === "CHANGES_REQUESTED" || s["status"] === "REJECTED") && (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm"><span className="font-medium">Reviewer: </span>{s.admin_feedback}</p>
      )}
    </Link>
  );
}
