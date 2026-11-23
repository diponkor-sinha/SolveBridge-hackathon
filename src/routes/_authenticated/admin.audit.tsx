import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/dashboard/side-nav";
import { StatusTabs } from "@/components/admin/status-tabs";
import { actionLabel } from "@/components/admin/audit-label";
import { Pager } from "@/components/site/pager";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { adminAuditQuery } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";

type T = "problem" | "solution" | "user" | "category";
type Tab = T | "all";
const TYPES: T[] = ["problem", "solution", "user", "category"];

export const Route = createFileRoute("/_authenticated/admin/audit")({
  validateSearch: (s: Record<string, unknown>): { page?: number | undefined; type?: T | undefined } => ({
    page: Number(s["page"]) > 1 ? Math.floor(Number(s["page"])) : undefined,
    type: TYPES.includes(s["type"] as T) ? (s["type"] as T) : undefined,
  }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1, type: search.type }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(adminAuditQuery(deps)),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: Audit,
});

function Audit() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/audit" });
  const { data } = useSuspenseQuery(adminAuditQuery({ page: search.page ?? 1, type: search.type }));
  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "problem", label: "Problems" },
    { value: "solution", label: "Solutions" },
    { value: "user", label: "Users" },
    { value: "category", label: "Categories" },
  ];

  return (
    <>
      <PageTitle eyebrow="Accountability" title="Audit log">Every admin action, newest first.</PageTitle>
      <StatusTabs<Tab> value={search.type ?? "all"} options={tabs} onChange={(v) => navigate({ search: { type: v === "all" ? undefined : v, page: undefined } })} />
      <div className="mt-4">
        {data.entries.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
            {data.entries.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <p><span className="font-medium">{e.admin}</span> {actionLabel(e.action)}: <span className="text-foreground/80">{e.target}</span></p>
                  <span className="font-mono text-xs text-muted-foreground">{formatDateTime(e.created_at)}</span>
                </div>
                {e.feedback && <p className="mt-1 whitespace-pre-line text-muted-foreground">“{e.feedback}”</p>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No entries yet" />
        )}
      </div>
      <Pager page={data.page} pageCount={data.pageCount} onPage={(p) => navigate({ search: (prev) => ({ ...prev, page: p > 1 ? p : undefined }) })} />
    </>
  );
}
