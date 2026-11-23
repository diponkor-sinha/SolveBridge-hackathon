import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/dashboard/side-nav";
import { StatusTabs } from "@/components/admin/status-tabs";
import { Pager } from "@/components/site/pager";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { ProblemStatusBadge } from "@/components/site/status-badge";
import { adminProblemsQuery } from "@/lib/queries";
import type { ProblemStatus } from "@/lib/constants";
import { formatDate } from "@/lib/format";

const TABS: { value: ProblemStatus; label: string }[] = [
  { value: "PENDING_REVIEW", label: "Pending" },
  { value: "APPROVED", label: "Published" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ARCHIVED", label: "Archived" },
];
const STATUSES = TABS.map((t) => t.value);

type S = { status?: ProblemStatus | undefined; q?: string | undefined; page?: number | undefined };

export const Route = createFileRoute("/_authenticated/admin/problems/")({
  validateSearch: (s: Record<string, unknown>): S => ({
    status: STATUSES.includes(s["status"] as ProblemStatus) ? (s["status"] as ProblemStatus) : undefined,
    q: typeof s["q"] === "string" && s["q"].trim() ? s["q"].slice(0, 200) : undefined,
    page: Number(s["page"]) > 1 ? Math.floor(Number(s["page"])) : undefined,
  }),
  loaderDeps: ({ search }) => ({ status: search.status ?? "PENDING_REVIEW", q: search.q, page: search.page ?? 1 }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(adminProblemsQuery(deps)),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: AdminProblems,
});

function AdminProblems() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/problems/" });
  const deps = { status: search.status ?? "PENDING_REVIEW", q: search.q, page: search.page ?? 1 } as const;
  const { data } = useSuspenseQuery(adminProblemsQuery(deps));
  const [q, setQ] = useState(search.q ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    navigate({ search: (p) => ({ ...p, q: q.trim() || undefined, page: undefined }) });
  }

  return (
    <>
      <PageTitle eyebrow="Moderation" title="Problems" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTabs value={deps.status} options={TABS} onChange={(v) => navigate({ search: { status: v, q: search.q, page: undefined } })} />
        <form onSubmit={submit} className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or reference" className="w-56" maxLength={200} aria-label="Search problems" />
          <Button type="submit" variant="outline">Search</Button>
        </form>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{data.total} total</p>
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
        {data.problems.length ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Problem</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Category</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Submitted</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.problems.map((p) => (
                <tr key={p.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link to="/admin/problems/$problemId" params={{ problemId: p.id }} className="font-medium hover:text-primary">{p.title}</Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      {p.reference_id}{p.solutionCount ? ` · ${p.solutionCount} solution${p.solutionCount === 1 ? "" : "s"}` : ""}{p.claimed ? " · claimed" : ""}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{p.category}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3"><ProblemStatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-4"><EmptyState title="Nothing here">No problems with this status.</EmptyState></div>
        )}
      </div>
      <Pager page={data.page} pageCount={data.pageCount} onPage={(p) => navigate({ search: (prev) => ({ ...prev, page: p > 1 ? p : undefined }) })} />
    </>
  );
}
