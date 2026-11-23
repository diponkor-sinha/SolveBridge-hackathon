import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/site/pager";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { ProblemStatusBadge } from "@/components/site/status-badge";
import { solvedQuery } from "@/lib/queries";
import { solutionTypeLabel } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/solved")({
  validateSearch: (s: Record<string, unknown>): { page?: number | undefined } => ({
    page: Number(s["page"]) > 1 ? Math.min(500, Math.floor(Number(s["page"]))) : undefined,
  }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(solvedQuery(deps.page)),
  head: () => ({
    meta: [
      { title: "Solved problems — SolveBridge" },
      { name: "description", content: "Real problems and the reviewed solutions solvers built for them." },
      { property: "og:title", content: "Solved problems — SolveBridge" },
      { property: "og:description", content: "Real problems and the reviewed solutions solvers built for them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => <div className="px-4 py-16"><PageError error={error} /></div>,
  notFoundComponent: () => <div className="px-4 py-16"><EmptyState title="Nothing here" /></div>,
  component: Solved,
});

function Solved() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/solved" });
  const { data } = useSuspenseQuery(solvedQuery(search.page ?? 1));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="eyebrow text-primary">Bridges built</p>
      <h1 className="mt-2 text-4xl font-bold">Solved problems</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Each accepted solution is shown next to the problem it answers.</p>

      <div className="mt-8 space-y-5">
        {data.solutions.length ? (
          data.solutions.map((s) => (
            <article key={s.id} className="grid overflow-hidden rounded-xl border border-border bg-card shadow-card md:grid-cols-2">
              <div className="border-b border-border bg-muted/40 p-6 md:border-b-0 md:border-r">
                <div className="flex items-center gap-2">
                  <span className="eyebrow text-muted-foreground">The problem</span>
                  <ProblemStatusBadge status={s.problem.status} />
                </div>
                <Link to="/problems/$referenceId" params={{ referenceId: s.problem.reference_id }} className="mt-2 block text-lg font-semibold hover:text-primary">
                  {s.problem.title}
                </Link>
                <p className="mt-2 text-sm text-muted-foreground">{s.problem.description}</p>
                <p className="mt-3 font-mono text-xs text-muted-foreground">{s.problem.reference_id}{s.problem.category ? ` · ${s.problem.category}` : ""}</p>
              </div>
              <div className="p-6">
                <span className="eyebrow text-success">Accepted · {solutionTypeLabel(s.solution_type)}</span>
                <h2 className="mt-2 text-lg font-semibold">{s.title}</h2>
                <p className="mt-2 line-clamp-5 whitespace-pre-line text-sm text-foreground/85">{s.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {s.github_url && <Button asChild variant="outline" size="sm"><a href={s.github_url} target="_blank" rel="noopener noreferrer nofollow"><Github /> Code</a></Button>}
                  {s.demo_url && <Button asChild variant="outline" size="sm"><a href={s.demo_url} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink /> Demo</a></Button>}
                  <span className="ml-auto text-xs text-muted-foreground">by {s.author} · {formatDate(s.reviewed_at)}</span>
                </div>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="No solved problems yet" action={<Button asChild><Link to="/problems" search={{ q: undefined, category: undefined, page: undefined }}>Find a problem to solve</Link></Button>}>
            Accepted solutions will appear here.
          </EmptyState>
        )}
      </div>
      <Pager page={data.page} pageCount={data.pageCount} onPage={(p) => navigate({ search: { page: p > 1 ? p : undefined } })} />
    </div>
  );
}
