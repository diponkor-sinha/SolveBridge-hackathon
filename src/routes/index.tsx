import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, ClipboardList, KeyRound, Search, ShieldCheck } from "lucide-react";
import heroImg from "@/assets/hero-bridge.webp";
import { Button } from "@/components/ui/button";
import { ProblemCard } from "@/components/site/problem-card";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { homeQuery } from "@/lib/queries";
import { solutionTypeLabel } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SolveBridge — post real problems, get reviewed solutions" },
      {
        name: "description",
        content: "Anyone can post a real-world problem anonymously. Solvers pick it up and submit solutions that are reviewed before going public.",
      },
      { property: "og:title", content: "SolveBridge — post real problems, get reviewed solutions" },
      { property: "og:description", content: "Anyone can post a real-world problem anonymously. Solvers pick it up and submit reviewed solutions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  errorComponent: ({ error }) => <div className="px-4 py-16"><PageError error={error} /></div>,
  notFoundComponent: () => <div className="px-4 py-16"><EmptyState title="Nothing here" /></div>,
  component: Home,
});

const STEPS = [
  { icon: ClipboardList, title: "Post a problem", body: "Describe a real problem — no account needed. You get a reference ID and a private claim key." },
  { icon: ShieldCheck, title: "We review it", body: "Every problem is checked by our team before it appears in the public directory." },
  { icon: Search, title: "Solvers pick it up", body: "Builders, students and researchers choose problems and work on answers." },
  { icon: CheckCircle2, title: "Solutions go public", body: "Reviewed and accepted solutions are published next to the original problem." },
];

function Home() {
  const { data } = useSuspenseQuery(homeQuery);
  return (
    <>
      <section className="paper-grain border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div className="animate-rise">
            <p className="eyebrow text-primary">Problems in · solutions out</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] text-balance sm:text-5xl lg:text-6xl">
              Every problem deserves a <span className="relative whitespace-nowrap"><span className="relative z-10">bridge</span><span className="absolute inset-x-0 bottom-1 -z-0 h-3 rounded bg-signal/70" aria-hidden="true" /></span> to its solution.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Post a real-world problem anonymously. Solvers choose it, build answers, and our reviewers publish the ones that work.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="signal" size="lg">
                <Link to="/submit">Submit a problem <ArrowRight /></Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/problems" search={{ q: undefined, category: undefined, page: undefined }}>Explore problems</Link>
              </Button>
            </div>
            <dl className="mt-10 flex gap-10">
              <div>
                <dt className="eyebrow text-muted-foreground">Open problems</dt>
                <dd className="font-display text-4xl font-bold">{data.totalProblems}</dd>
              </div>
              <div>
                <dt className="eyebrow text-muted-foreground">Accepted solutions</dt>
                <dd className="font-display text-4xl font-bold">{data.totalSolutions}</dd>
              </div>
            </dl>
          </div>
          <div className="stamp overflow-hidden rounded-2xl bg-card animate-rise [animation-delay:120ms]">
            <img src={heroImg} alt="People carrying planks and light bulbs across a bridge they are building over a canyon" className="h-full w-full object-cover" width={1600} height={1008} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="eyebrow text-primary">How it works</p>
        <h2 className="mt-2 text-3xl font-bold">Four steps from problem to published solution</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <s.icon className="h-6 w-6 text-primary" />
                <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-primary">Fresh from the community</p>
            <h2 className="mt-2 text-3xl font-bold">Recent problems</h2>
          </div>
          <Link to="/problems" search={{ q: undefined, category: undefined, page: undefined }} className="hidden text-sm font-medium text-primary hover:underline sm:block">
            See all problems →
          </Link>
        </div>
        <div className="mt-6">
          {data.recentProblems.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.recentProblems.map((p) => <ProblemCard key={p.id} problem={p} />)}
            </div>
          ) : (
            <EmptyState title="No published problems yet" action={<Button asChild><Link to="/submit">Post the first one</Link></Button>}>
              Problems appear here once our reviewers approve them.
            </EmptyState>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16">
        <p className="eyebrow text-primary">Bridges built</p>
        <h2 className="mt-2 text-3xl font-bold">Recently accepted solutions</h2>
        <div className="mt-6">
          {data.recentSolutions.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {data.recentSolutions.map((s) => (
                <Link
                  key={s.id}
                  to="/problems/$referenceId"
                  params={{ referenceId: s.problem?.reference_id ?? "" }}
                  className="rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-lift"
                >
                  <span className="eyebrow text-success">{solutionTypeLabel(s.solution_type)}</span>
                  <h3 className="mt-2 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">For: {s.problem?.title}</p>
                  <p className="mt-4 text-xs text-muted-foreground">by {s.author} · {formatDate(s.reviewed_at)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No accepted solutions yet">The first accepted solutions will be featured here.</EmptyState>
          )}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="stamp grid gap-6 rounded-2xl bg-ink p-8 text-ink-foreground md:grid-cols-[1fr_auto] md:items-center md:p-12">
          <div>
            <KeyRound className="h-7 w-7 text-signal" />
            <h2 className="mt-3 text-3xl font-bold">Know a problem that needs solving?</h2>
            <p className="mt-2 max-w-xl text-ink-foreground/80">
              Post it anonymously in two minutes. Keep your claim key and you can link the problem to an account later.
            </p>
          </div>
          <Button asChild variant="signal" size="lg">
            <Link to="/submit">Submit a problem <ArrowRight /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}
