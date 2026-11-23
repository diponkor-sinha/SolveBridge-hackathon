import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ExternalLink, Github } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReviewHistory } from "@/components/admin/review-history";
import { MediaList } from "@/components/site/media-list";
import { PageError } from "@/components/site/empty-state";
import { ProblemStatusBadge, SolutionStatusBadge } from "@/components/site/status-badge";
import { adminSolutionQuery } from "@/lib/queries";
import { adminReviewSolution } from "@/lib/admin.functions";
import { allowedSolutionActions, SOLUTION_ACTION_LABEL, solutionFeedbackRequired, type SolutionAction } from "@/lib/review-rules";
import { solutionTypeLabel } from "@/lib/constants";
import { errorMessage, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/solutions/$solutionId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(adminSolutionQuery(params.solutionId)),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: AdminSolution,
});

const VARIANT: Record<SolutionAction, "default" | "destructive" | "outline"> = {
  accept: "default",
  reject: "destructive",
  request_changes: "outline",
};

function AdminSolution() {
  const { solutionId } = Route.useParams();
  const { data } = useSuspenseQuery(adminSolutionQuery(solutionId));
  const s = data.solution;
  const qc = useQueryClient();
  const reviewFn = useServerFn(adminReviewSolution);
  const [feedback, setFeedback] = useState("");
  const review = useMutation({
    mutationFn: (action: SolutionAction) => reviewFn({ data: { id: s.id, action, feedback: feedback.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Review saved");
      setFeedback("");
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["solved"] });
      qc.invalidateQueries({ queryKey: ["problem"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const actions = allowedSolutionActions(s["status"]);

  function run(a: SolutionAction) {
    if (solutionFeedbackRequired(a) && !feedback.trim()) {
      toast.error("Add feedback so the solver knows why.");
      return;
    }
    review.mutate(a);
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/solutions" search={{ status: s["status"], page: undefined }} className="text-sm text-muted-foreground hover:text-foreground">← Solutions</Link>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <article className="min-w-0 space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SolutionStatusBadge status={s["status"]} />
              <span className="eyebrow text-muted-foreground">{solutionTypeLabel(s.solution_type)}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold">{s.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              by {s.author}{s.authorEmail ? ` (${s.authorEmail})` : ""} · submitted {formatDateTime(s.created_at)} · updated {formatDateTime(s.updated_at)}
            </p>
          </div>
          {s.problems && (
            <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm">
              <p className="eyebrow text-muted-foreground">Problem</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Link to="/admin/problems/$problemId" params={{ problemId: s.problems.id }} className="font-medium hover:text-primary">{s.problems.title}</Link>
                <ProblemStatusBadge status={s.problems.status} />
              </div>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="whitespace-pre-line text-sm leading-relaxed">{s.description}</p>
            {(s.github_url || s.demo_url) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {s.github_url && <Button asChild variant="outline" size="sm"><a href={s.github_url} target="_blank" rel="noopener noreferrer nofollow"><Github /> {s.github_url}</a></Button>}
                {s.demo_url && <Button asChild variant="outline" size="sm"><a href={s.demo_url} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink /> {s.demo_url}</a></Button>}
              </div>
            )}
          </div>
          {s.media.length > 0 && <MediaList media={s.media} />}
        </article>

        <aside className="space-y-4">
          <div className="stamp rounded-xl bg-card p-5">
            <h2 className="font-semibold">Review</h2>
            {s.admin_feedback && (
              <p className="mt-2 rounded-md bg-muted p-2 text-xs"><span className="font-medium">Last feedback:</span> {s.admin_feedback}</p>
            )}
            {actions.length ? (
              <>
                <Label htmlFor="fb" className="mt-3 block text-xs text-muted-foreground">Feedback for the solver (required to reject or request changes)</Label>
                <Textarea id="fb" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} maxLength={2000} className="mt-1" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {actions.map((a) => (
                    <Button key={a} size="sm" variant={VARIANT[a]} disabled={review.isPending} onClick={() => run(a)}>
                      {SOLUTION_ACTION_LABEL[a]}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {s["status"] === "CHANGES_REQUESTED" ? "Waiting for the solver to resubmit." : "No actions available."}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-semibold">History</h2>
            <ReviewHistory items={data.history} />
          </div>
        </aside>
      </div>
    </div>
  );
}
