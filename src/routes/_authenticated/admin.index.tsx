import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageTitle, StatCard } from "@/components/dashboard/side-nav";
import { PageError } from "@/components/site/empty-state";
import { adminOverviewQuery } from "@/lib/queries";
import { PROBLEM_STATUS_LABEL, SOLUTION_STATUS_LABEL, type ProblemStatus, type SolutionStatus } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { actionLabel } from "@/components/admin/audit-label";

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminOverviewQuery),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: AdminOverview,
});

function AdminOverview() {
  const { data } = useSuspenseQuery(adminOverviewQuery);
  const pc = data.problemCounts;
  const sc = data.solutionCounts;
  const maxDay = Math.max(1, ...data.activity.map((d) => Math.max(d.problems, d.solutions)));
  const maxCat = Math.max(1, ...data.byCategory.map((c) => c.count));

  return (
    <>
      <PageTitle eyebrow="Admin" title="Overview & reports" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link to="/admin/problems" search={{ status: "PENDING_REVIEW", q: undefined, page: undefined }}>
          <StatCard label="Problems to review" value={pc.PENDING_REVIEW} tone="signal" />
        </Link>
        <Link to="/admin/solutions" search={{ status: "SUBMITTED", page: undefined }}>
          <StatCard label="Solutions to review" value={sc.SUBMITTED} tone="signal" />
        </Link>
        <StatCard label="Registered users" value={data.totalUsers} />
        <StatCard label="Active selections" value={data.activeSelections} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Problems by status">
          <ul className="space-y-2 text-sm">
            {(Object.keys(pc) as ProblemStatus[]).map((s) => (
              <li key={s}>
                <Link to="/admin/problems" search={{ status: s, q: undefined, page: undefined }} className="flex justify-between rounded-md px-2 py-1 hover:bg-accent">
                  <span>{PROBLEM_STATUS_LABEL[s]}</span>
                  <span className="font-mono font-semibold">{pc[s]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Solutions by status">
          <ul className="space-y-2 text-sm">
            {(Object.keys(sc) as SolutionStatus[]).map((s) => (
              <li key={s}>
                <Link to="/admin/solutions" search={{ status: s, page: undefined }} className="flex justify-between rounded-md px-2 py-1 hover:bg-accent">
                  <span>{SOLUTION_STATUS_LABEL[s]}</span>
                  <span className="font-mono font-semibold">{sc[s]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Last 14 days">
          <div className="flex h-40 items-end gap-1.5" role="img" aria-label="New problems and solutions per day over the last 14 days">
            {data.activity.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.problems} problems, ${d.solutions} solutions`}>
                <div className="flex h-32 w-full items-end gap-0.5">
                  <div className="flex-1 rounded-t bg-primary" style={{ height: `${(d.problems / maxDay) * 100}%` }} />
                  <div className="flex-1 rounded-t bg-signal" style={{ height: `${(d.solutions / maxDay) * 100}%` }} />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Problems</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-signal" />Solutions</span>
          </div>
        </Panel>

        <Panel title="Problems by category">
          {data.byCategory.length ? (
            <ul className="space-y-2 text-sm">
              {data.byCategory.map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between"><span>{c.name}</span><span className="font-mono">{c.count}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(c.count / maxCat) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No problems yet.</p>
          )}
        </Panel>
      </div>

      <Panel title="Recent admin actions" className="mt-6">
        {data.recentAudit.length ? (
          <ul className="divide-y divide-border text-sm">
            {data.recentAudit.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 py-2">
                <span><span className="font-medium">{a.admin}</span> · {actionLabel(a.action)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No actions yet.</p>
        )}
        <Link to="/admin/audit" search={{ page: undefined, type: undefined }} className="mt-3 inline-block text-sm text-primary hover:underline">Full audit log →</Link>
      </Panel>
    </>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 shadow-card ${className}`}>
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
