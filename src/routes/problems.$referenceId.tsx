import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ExternalLink, Github, Hash, MapPin, Tag, Users } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProblemStatusBadge, SolutionStatusBadge } from "@/components/site/status-badge";
import { MediaList } from "@/components/site/media-list";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { problemQuery } from "@/lib/queries";
import { getMySelection, selectProblem, withdrawSelection } from "@/lib/solver.functions";
import { useAuth } from "@/lib/auth";
import { solutionTypeLabel } from "@/lib/constants";
import { errorMessage, formatDate } from "@/lib/format";

export const Route = createFileRoute("/problems/$referenceId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(problemQuery(params.referenceId.toUpperCase())),
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.problem.title} — SolveBridge` : "Problem — SolveBridge";
    const description = loaderData ? loaderData.problem.description.slice(0, 155) : "A real-world problem on SolveBridge.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  errorComponent: ({ error }) => <div className="px-4 py-16"><PageError error={error} /></div>,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState title="Problem not found" action={<Button asChild><Link to="/problems" search={{ q: undefined, category: undefined, page: undefined }}>Browse problems</Link></Button>}>
        It may still be waiting for review, or the link is wrong.
      </EmptyState>
    </div>
  ),
  component: ProblemPage,
});

function ProblemPage() {
  const { referenceId } = Route.useParams();
  const { data } = useSuspenseQuery(problemQuery(referenceId.toUpperCase()));
  const p = data.problem;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/problems" search={{ q: undefined, category: undefined, page: undefined }} className="text-sm text-muted-foreground hover:text-foreground">
        ← All problems
      </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ProblemStatusBadge status={p.status} />
            <span className="eyebrow text-primary">{p.category?.name}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-balance sm:text-4xl">{p.title}</h1>
          <div className="prose-sm mt-6 whitespace-pre-line text-base leading-relaxed text-foreground/90">{p.description}</div>
          {p.additional_info && (
            <div className="mt-6 rounded-xl border border-border bg-muted/50 p-5">
              <h2 className="eyebrow text-muted-foreground">Additional information</h2>
              <p className="mt-2 whitespace-pre-line text-sm">{p.additional_info}</p>
            </div>
          )}
          {p.media.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 font-semibold">Attachments</h2>
              <MediaList media={p.media} />
            </div>
          )}

          <section className="mt-12">
            <h2 className="text-2xl font-bold">Accepted solutions</h2>
            <div className="mt-4 space-y-4">
              {data.solutions.length ? (
                data.solutions.map((s) => (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-6 shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="eyebrow text-success">{solutionTypeLabel(s.solution_type)}</span>
                      <span className="text-xs text-muted-foreground">by {s.author} · accepted {formatDate(s.reviewed_at)}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-2 whitespace-pre-line text-sm text-foreground/85">{s.description}</p>
                    {(s.github_url || s.demo_url) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {s.github_url && (
                          <Button asChild variant="outline" size="sm"><a href={s.github_url} target="_blank" rel="noopener noreferrer nofollow"><Github /> Code</a></Button>
                        )}
                        {s.demo_url && (
                          <Button asChild variant="outline" size="sm"><a href={s.demo_url} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink /> Live demo</a></Button>
                        )}
                      </div>
                    )}
                    {s.media.length > 0 && <div className="mt-4"><MediaList media={s.media} /></div>}
                  </div>
                ))
              ) : (
                <EmptyState title="No accepted solutions yet">Be the first — choose this problem and submit your idea.</EmptyState>
              )}
            </div>
          </section>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="stamp rounded-xl bg-card p-5">
            <dl className="space-y-3 text-sm">
              <Meta icon={Hash} label="Reference"><span className="font-mono">{p.reference_id}</span></Meta>
              <Meta icon={Tag} label="Category">{p.category?.name ?? "—"}</Meta>
              {p.location && <Meta icon={MapPin} label="Location">{p.location}</Meta>}
              <Meta icon={CalendarDays} label="Submitted">{formatDate(p.created_at)}</Meta>
              <Meta icon={Users} label="Active solvers">
                <span className="font-display text-lg font-bold">{p.solverCount}</span>
              </Meta>
            </dl>
            <div className="mt-5 border-t border-border pt-5">
              <ChooseProblem problemId={p.id} referenceId={p.reference_id} open={p.status === "APPROVED"} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, label, children }: { icon: typeof Hash; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

function ChooseProblem({ problemId, referenceId, open }: { problemId: string; referenceId: string; open: boolean }) {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const fetchSel = useServerFn(getMySelection);
  const selectFn = useServerFn(selectProblem);
  const withdrawFn = useServerFn(withdrawSelection);
  const key = ["me", "selection", problemId];
  const sel = useQuery({ queryKey: key, enabled: Boolean(user), queryFn: () => fetchSel({ data: { problemId } }) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["problem", referenceId] });
    qc.invalidateQueries({ queryKey: ["me", "dashboard"] });
  };
  const choose = useMutation({
    mutationFn: () => selectFn({ data: { problemId } }),
    onSuccess: () => { toast.success("You're on it! This problem is now in your dashboard."); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const withdraw = useMutation({
    mutationFn: () => withdrawFn({ data: { problemId } }),
    onSuccess: () => { toast.success("You've withdrawn from this problem."); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!open) return <p className="text-sm text-muted-foreground">This problem is marked resolved and isn't taking new solvers.</p>;
  if (loading || (user && sel.isPending)) return <div className="h-10 animate-pulse rounded-md bg-muted" />;
  if (!user) {
    return (
      <div className="space-y-2">
        <Button asChild variant="signal" className="w-full">
          <Link to="/auth" search={{ redirect: `/problems/${referenceId}`, mode: undefined }}>Sign in to choose this problem</Link>
        </Button>
        <p className="text-xs text-muted-foreground">Solver names stay private — only the total count is shown.</p>
      </div>
    );
  }
  if (sel.isError) return <p className="text-sm text-destructive">{errorMessage(sel.error)}</p>;
  const { selected, solution } = sel.data!;
  if (!selected && !solution) {
    return (
      <div className="space-y-2">
        <Button variant="signal" className="w-full" disabled={choose.isPending} onClick={() => choose.mutate()}>
          Choose this problem
        </Button>
        <p className="text-xs text-muted-foreground">Others can choose it too. You can withdraw any time.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-success">✓ You're working on this problem</p>
      {solution ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <span>Your solution</span>
          <SolutionStatusBadge status={solution.status} />
        </div>
      ) : (
        <Button asChild className="w-full">
          <Link to="/dashboard/solve/$referenceId" params={{ referenceId }}>Submit a solution</Link>
        </Button>
      )}
      {solution && (
        <Button asChild variant="outline" className="w-full">
          <Link to="/dashboard/solutions/$solutionId" params={{ solutionId: solution.id }}>View my solution</Link>
        </Button>
      )}
      {selected && (
        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
          Withdraw
        </Button>
      )}
    </div>
  );
}
