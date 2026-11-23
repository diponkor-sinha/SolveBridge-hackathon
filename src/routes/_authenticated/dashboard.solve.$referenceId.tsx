import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SolutionForm } from "@/components/dashboard/solution-form";
import { PageTitle } from "@/components/dashboard/side-nav";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { solveContextQuery } from "@/lib/queries";
import { submitSolution } from "@/lib/solver.functions";
import { errorMessage } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/solve/$referenceId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(solveContextQuery(params.referenceId)),
  head: () => ({ meta: [{ title: "Submit a solution — SolveBridge" }, { name: "robots", content: "noindex" }] }),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: Solve,
});

function Solve() {
  const { referenceId } = Route.useParams();
  const { data } = useSuspenseQuery(solveContextQuery(referenceId));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitSolution);
  const submit = useMutation({
    mutationFn: (fd: FormData) => submitFn({ data: fd }),
    onSuccess: (r) => {
      toast.success("Solution submitted for review");
      if (r.filesSent > r.filesSaved) toast.warning("Some attachments could not be saved.");
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/dashboard/solutions/$solutionId", params: { solutionId: r.id } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const p = data.problem;

  return (
    <>
      <PageTitle eyebrow={p.reference_id} title="Submit your solution">
        For <Link to="/problems/$referenceId" params={{ referenceId: p.reference_id }} className="text-primary hover:underline">{p.title}</Link>
      </PageTitle>
      {p.status !== "APPROVED" ? (
        <EmptyState title="This problem isn't taking new solutions">It has been marked resolved.</EmptyState>
      ) : data.activeSolution ? (
        <EmptyState
          title="You already have a solution for this problem"
          action={<Button asChild><Link to="/dashboard/solutions/$solutionId" params={{ solutionId: data.activeSolution.id }}>View it</Link></Button>}
        >
          One active solution per problem. You can edit it if a reviewer asks for changes.
        </EmptyState>
      ) : !data.selected ? (
        <EmptyState
          title="Choose this problem first"
          action={<Button asChild><Link to="/problems/$referenceId" params={{ referenceId: p.reference_id }}>Open the problem</Link></Button>}
        >
          Press “Choose this problem” on its page, then come back here.
        </EmptyState>
      ) : (
        <SolutionForm hidden={{ problem_id: p.id }} submitLabel="Submit for review" pending={submit.isPending} onSubmit={(fd) => submit.mutate(fd)} />
      )}
    </>
  );
}
