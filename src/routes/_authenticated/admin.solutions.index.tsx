import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/dashboard/side-nav";
import { StatusTabs } from "@/components/admin/status-tabs";
import { Pager } from "@/components/site/pager";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { SolutionStatusBadge } from "@/components/site/status-badge";
import { adminSolutionsQuery } from "@/lib/queries";
import { solutionTypeLabel, type SolutionStatus } from "@/lib/constants";
import { formatDate } from "@/lib/format";

const TABS: { value: SolutionStatus; label: string }[] = [
  { value: "SUBMITTED", label: "To review" },
  { value: "CHANGES_REQUESTED", label: "Changes requested" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
];
const STATUSES = TABS.map((t) => t.value);

export const Route = createFileRoute("/_authenticated/admin/solutions/")({
  validateSearch: (s: Record<string, unknown>): { status?: SolutionStatus | undefined; page?: number | undefined } => ({
    status: STATUSES.includes(s["status"] as SolutionStatus) ? (s["status"] as SolutionStatus) : undefined,
    page: Number(s["page"]) > 1 ? Math.floor(Number(s["page"])) : undefined,
  }),
  loaderDeps: ({ search }) => ({ status: search.status ?? "SUBMITTED", page: search.page ?? 1 }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(adminSolutionsQuery(deps)),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: AdminSolutions,
});

function AdminSolutions() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/solutions/" });
  const deps = { status: search.status ?? "SUBMITTED", page: search.page ?? 1 } as const;
  const { data } = useSuspenseQuery(adminSolutionsQuery(deps));

  return (
    <>
      <PageTitle eyebrow="Moderation" title="Solutions" />
      <StatusTabs value={deps.status} options={TABS} onChange={(v) => navigate({ search: { status: v, page: undefined } })} />
      <p className="mt-4 text-sm text-muted-foreground">{data.total} total</p>
      <div className="mt-3 space-y-3">
        {data.solutions.length ? (
          data.solutions.map((s) => (
            <Link
              key={s.id}
              to="/admin/solutions/$solutionId"
              params={{ solutionId: s.id }}
              className="block rounded-xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{s.title}</h3>
                <SolutionStatusBadge status={s["status"]} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                For <span className="text-foreground">{s.problem?.title}</span> · {solutionTypeLabel(s.solution_type)} · by {s.author} · updated {formatDate(s.updated_at)}
              </p>
            </Link>
          ))
        ) : (
          <EmptyState title="Nothing here">No solutions with this status.</EmptyState>
        )}
      </div>
      <Pager page={data.page} pageCount={data.pageCount} onPage={(p) => navigate({ search: (prev) => ({ ...prev, page: p > 1 ? p : undefined }) })} />
    </>
  );
}
