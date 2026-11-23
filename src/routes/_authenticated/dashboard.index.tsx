import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageTitle, StatCard } from "@/components/dashboard/side-nav";
import { SolutionRow } from "@/components/dashboard/solution-row";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { dashboardQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({ meta: [{ title: "My dashboard — SolveBridge" }, { name: "robots", content: "noindex" }] }),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: Overview,
});

function Overview() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const { user } = useAuth();
  const active = data.selections.filter((s) => s.active);
  const count = (st: string) => data.solutions.filter((s) => s["status"] === st).length;
  const name = data.profile.full_name || user?.email?.split("@")[0] || "solver";

  return (
    <>
      <PageTitle eyebrow="Overview" title={`Welcome back, ${name}`}>Here's where your work stands.</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active problems" value={active.length} />
        <StatCard label="Under review" value={count("SUBMITTED")} />
        <StatCard label="Changes requested" value={count("CHANGES_REQUESTED")} tone="warning" />
        <StatCard label="Accepted" value={count("ACCEPTED")} tone="success" />
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Latest solutions</h2>
          <Link to="/dashboard/solutions" className="text-sm text-primary hover:underline">All solutions →</Link>
        </div>
        <div className="mt-4 space-y-3">
          {data.solutions.length ? (
            data.solutions.slice(0, 4).map((s) => <SolutionRow key={s.id} s={s} />)
          ) : (
            <EmptyState
              title="No solutions yet"
              action={<Button asChild><Link to="/problems" search={{ q: undefined, category: undefined, page: undefined }}>Find a problem</Link></Button>}
            >
              Choose a problem from the directory, then submit your solution from here.
            </EmptyState>
          )}
        </div>
      </section>

      {active.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Problems you're working on</h2>
            <Link to="/dashboard/problems" className="text-sm text-primary hover:underline">Manage →</Link>
          </div>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
            {active.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link to="/problems/$referenceId" params={{ referenceId: s.problem?.reference_id ?? "" }} className="min-w-0 truncate font-medium hover:text-primary">
                  {s.problem?.title}
                </Link>
                {!s.solution && s.problem?.status === "APPROVED" && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/dashboard/solve/$referenceId" params={{ referenceId: s.problem.reference_id }}>Submit solution</Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
