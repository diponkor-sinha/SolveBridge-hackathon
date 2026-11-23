import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/dashboard/side-nav";
import { SolutionRow } from "@/components/dashboard/solution-row";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { dashboardQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard/revisions")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({ meta: [{ title: "Revision requests — SolveBridge" }, { name: "robots", content: "noindex" }] }),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: Revisions,
});

function Revisions() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const list = data.solutions.filter((s) => s["status"] === "CHANGES_REQUESTED");
  return (
    <>
      <PageTitle eyebrow="My work" title="Revision requests">Reviewers asked for changes on these. Open one to edit and resubmit.</PageTitle>
      <div className="space-y-3">
        {list.length ? list.map((s) => <SolutionRow key={s.id} s={s} />) : <EmptyState title="Nothing to revise">You're all caught up.</EmptyState>}
      </div>
    </>
  );
}
