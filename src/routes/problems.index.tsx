import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProblemCard } from "@/components/site/problem-card";
import { Pager } from "@/components/site/pager";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { categoriesQuery, problemsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

type S = { q?: string | undefined; category?: string | undefined; page?: number | undefined };

export const Route = createFileRoute("/problems/")({
  validateSearch: (s: Record<string, unknown>): S => ({
    q: typeof s["q"] === "string" && s["q"].trim() ? s["q"].slice(0, 200) : undefined,
    category: typeof s["category"] === "string" && s["category"] ? s["category"].slice(0, 60) : undefined,
    page: Number(s["page"]) > 1 ? Math.min(500, Math.floor(Number(s["page"]))) : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, category: search.category, page: search.page ?? 1 }),
  loader: ({ context, deps }) =>
    Promise.all([context.queryClient.ensureQueryData(problemsQuery(deps)), context.queryClient.ensureQueryData(categoriesQuery)]),
  head: () => ({
    meta: [
      { title: "Explore problems — SolveBridge" },
      { name: "description", content: "Browse reviewed, real-world problems by category and pick one to solve." },
      { property: "og:title", content: "Explore problems — SolveBridge" },
      { property: "og:description", content: "Browse reviewed, real-world problems by category and pick one to solve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => <div className="px-4 py-16"><PageError error={error} /></div>,
  notFoundComponent: () => <div className="px-4 py-16"><EmptyState title="No problems found" /></div>,
  component: Explore,
});

function Explore() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/problems/" });
  const deps = { q: search.q, category: search.category, page: search.page ?? 1 };
  const { data } = useSuspenseQuery(problemsQuery(deps));
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const [q, setQ] = useState(search.q ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    navigate({ search: (prev) => ({ ...prev, q: q.trim() || undefined, page: undefined }) });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="eyebrow text-primary">Problem directory</p>
      <h1 className="mt-2 text-4xl font-bold">Explore problems</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Every problem here has been reviewed. Open one to see the details and choose it.</p>

      <form onSubmit={submit} className="mt-8 flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by keyword" className="h-11 pl-9" maxLength={200} aria-label="Search problems" />
        </div>
        <Button type="submit" className="h-11">Search</Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter by category">
        <CategoryChip active={!search.category} onClick={() => navigate({ search: (p) => ({ ...p, category: undefined, page: undefined }) })}>
          All
        </CategoryChip>
        {categories.map((c) => (
          <CategoryChip key={c.id} active={search.category === c.slug} onClick={() => navigate({ search: (p) => ({ ...p, category: c.slug, page: undefined }) })}>
            {c.name}
          </CategoryChip>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {data.total} {data.total === 1 ? "problem" : "problems"}
        {search.q ? <> matching “{search.q}”</> : null}
      </p>
      <div className="mt-4">
        {data.problems.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.problems.map((p) => <ProblemCard key={p.id} problem={p} />)}
          </div>
        ) : (
          <EmptyState title="No problems match">Try another keyword or category.</EmptyState>
        )}
      </div>
      <Pager page={data.page} pageCount={data.pageCount} onPage={(p) => navigate({ search: (prev) => ({ ...prev, page: p > 1 ? p : undefined }) })} />
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "border-ink bg-ink text-ink-foreground" : "border-border bg-card text-foreground hover:border-primary",
      )}
    >
      {children}
    </button>
  );
}
