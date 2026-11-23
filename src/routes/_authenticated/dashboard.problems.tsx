import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/dashboard/side-nav";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { ProblemStatusBadge, SolutionStatusBadge } from "@/components/site/status-badge";
import { dashboardQuery } from "@/lib/queries";
import { withdrawSelection } from "@/lib/solver.functions";
import { errorMessage, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/problems")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({ meta: [{ title: "Selected problems — SolveBridge" }, { name: "robots", content: "noindex" }] }),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: SelectedProblems,
});

function SelectedProblems() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const qc = useQueryClient();
  const withdrawFn = useServerFn(withdrawSelection);
  const withdraw = useMutation({
    mutationFn: (problemId: string) => withdrawFn({ data: { problemId } }),
    onSuccess: () => {
      toast.success("Withdrawn");
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["problem"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const active = data.selections.filter((s) => s.active);
  const past = data.selections.filter((s) => !s.active);

  return (
    <>
      <PageTitle eyebrow="My work" title="Selected problems">Problems you've chosen to work on.</PageTitle>
      {active.length ? (
        <ul className="space-y-3">
          {active.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {s.problem && <ProblemStatusBadge status={s.problem.status} />}
                    <span className="font-mono text-xs text-muted-foreground">{s.problem?.reference_id}</span>
                  </div>
                  <Link to="/problems/$referenceId" params={{ referenceId: s.problem?.reference_id ?? "" }} className="mt-1 block font-semibold hover:text-primary">
                    {s.problem?.title ?? "Problem no longer available"}
                  </Link>
                  <p className="text-xs text-muted-foreground">Chosen {formatDate(s.created_at)}{s.problem?.category ? ` · ${s.problem.category}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {s.solution ? (
                    <Link to="/dashboard/solutions/$solutionId" params={{ solutionId: s.solution.id }} className="inline-flex items-center gap-2 text-sm">
                      <SolutionStatusBadge status={s.solution.status} /> View solution
                    </Link>
                  ) : s.problem?.status === "APPROVED" ? (
                    <Button asChild size="sm">
                      <Link to="/dashboard/solve/$referenceId" params={{ referenceId: s.problem.reference_id }}>Submit solution</Link>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" disabled={withdraw.isPending} onClick={() => withdraw.mutate(s.problemId)}>
                    Withdraw
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="You haven't chosen any problems"
          action={<Button asChild><Link to="/problems" search={{ q: undefined, category: undefined, page: undefined }}>Explore problems</Link></Button>}
        >
          Open a problem and press “Choose this problem” to add it here.
        </EmptyState>
      )}
      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Withdrawn</h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card text-sm">
            {past.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="truncate">{s.problem?.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">withdrawn {formatDate(s.withdrawn_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
