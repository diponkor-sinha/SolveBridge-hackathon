import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Github } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SolutionForm } from "@/components/dashboard/solution-form";
import { MediaList } from "@/components/site/media-list";
import { PageError } from "@/components/site/empty-state";
import { SolutionStatusBadge } from "@/components/site/status-badge";
import { mySolutionQuery } from "@/lib/queries";
import { updateSolution } from "@/lib/solver.functions";
import { SOLUTION_STATUS_LABEL, solutionTypeLabel } from "@/lib/constants";
import { errorMessage, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/solutions/$solutionId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(mySolutionQuery(params.solutionId)),
  head: () => ({ meta: [{ title: "My solution — SolveBridge" }, { name: "robots", content: "noindex" }] }),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: SolutionDetail,
});

const STATUS_NOTE = {
  SUBMITTED: "A reviewer will look at it soon.",
  ACCEPTED: "It's published on the problem page and in Solved problems.",
  REJECTED: "This solution won't be published. You can submit a new one for the same problem.",
  CHANGES_REQUESTED: "Update your solution below and resubmit it for review.",
} as const;

function SolutionDetail() {
  const { solutionId } = Route.useParams();
  const { data: s } = useSuspenseQuery(mySolutionQuery(solutionId));
  const qc = useQueryClient();
  const updateFn = useServerFn(updateSolution);
  const update = useMutation({
    mutationFn: (fd: FormData) => updateFn({ data: fd }),
    onSuccess: (r) => {
      toast.success("Resubmitted for review");
      if (r.filesSent > r.filesSaved) toast.warning("Some attachments could not be saved.");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <Link to="/dashboard/solutions" className="text-sm text-muted-foreground hover:text-foreground">← My solutions</Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <SolutionStatusBadge status={s["status"]} />
          <span className="eyebrow text-muted-foreground">{solutionTypeLabel(s.solution_type)}</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold">{s.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For{" "}
          {s.problems ? (
            <Link to="/problems/$referenceId" params={{ referenceId: s.problems.reference_id }} className="text-primary hover:underline">{s.problems.title}</Link>
          ) : "a problem"}{" "}
          · submitted {formatDateTime(s.created_at)}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm">
        <p className="font-medium">{SOLUTION_STATUS_LABEL[s["status"]]}: <span className="font-normal">{STATUS_NOTE[s["status"]]}</span></p>
        {s.admin_feedback && (
          <div className="mt-3 rounded-md border border-warning/40 bg-warning-soft p-3">
            <p className="eyebrow text-warning">Reviewer feedback</p>
            <p className="mt-1 whitespace-pre-line">{s.admin_feedback}</p>
          </div>
        )}
      </div>

      {s["status"] === "CHANGES_REQUESTED" ? (
        <SolutionForm
          defaults={s}
          hidden={{ solution_id: s.id }}
          submitLabel="Resubmit for review"
          pending={update.isPending}
          existingFiles={s.media.length}
          onSubmit={(fd) => update.mutate(fd)}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <p className="whitespace-pre-line text-sm leading-relaxed">{s.description}</p>
          {(s.github_url || s.demo_url) && (
            <div className="mt-4 flex gap-2">
              {s.github_url && <Button asChild variant="outline" size="sm"><a href={s.github_url} target="_blank" rel="noopener noreferrer"><Github /> Code</a></Button>}
              {s.demo_url && <Button asChild variant="outline" size="sm"><a href={s.demo_url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Demo</a></Button>}
            </div>
          )}
        </div>
      )}
      {s.media.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold">Attachments</h2>
          <MediaList media={s.media} />
        </div>
      )}
    </div>
  );
}
