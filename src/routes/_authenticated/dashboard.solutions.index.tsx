import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/dashboard/side-nav";
import { SolutionRow } from "@/components/dashboard/solution-row";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { dashboardQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard/solutions/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({ meta: [{ title: "My solutions — SolveBridge" }, { name: "robots", content: "noindex" }] }),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: MySolutions,
});

function MySolutions() {
  const { data } = useSuspenseQuery(dashboardQuery);
  return (
    <>
      <PageTitle eyebrow="My work" title="My solutions">Everything you've submitted and where it stands.</PageTitle>
      <div className="space-y-3">
        {data.solutions.length ? (
          data.solutions.map((s) => <SolutionRow key={s.id} s={s} />)
        ) : (
          <EmptyState title="No solutions yet" action={<Button asChild><Link to="/dashboard/problems">Go to my problems</Link></Button>}>
            Submit a solution for a problem you've chosen.
          </EmptyState>
        )}
      </div>
    </>
  );
}
