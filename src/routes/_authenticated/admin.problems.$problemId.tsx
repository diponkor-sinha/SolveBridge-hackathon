import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReviewHistory } from "@/components/admin/review-history";
import { MediaList } from "@/components/site/media-list";
import { PageError } from "@/components/site/empty-state";
import { ProblemStatusBadge, SolutionStatusBadge } from "@/components/site/status-badge";
import { adminProblemQuery } from "@/lib/queries";
import { adminSetProblemStatus } from "@/lib/admin.functions";
import { allowedProblemActions, PROBLEM_ACTION_LABEL, type ProblemAction } from "@/lib/review-rules";
import { errorMessage, formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/problems/$problemId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(adminProblemQuery(params.problemId)),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: AdminProblem,
});

const VARIANT: Record<ProblemAction, "default" | "destructive" | "outline"> = {
  approve: "default",
  reject: "destructive",
  resolve: "outline",
  archive: "outline",
};

function AdminProblem() {
  const { problemId } = Route.useParams();
  const { data } = useSuspenseQuery(adminProblemQuery(problemId));
  const p = data.problem;
  const qc = useQueryClient();
  const setStatusFn = useServerFn(adminSetProblemStatus);
  const [note, setNote] = useState("");
  const act = useMutation({
    mutationFn: (action: ProblemAction) => setStatusFn({ data: { id: p.id, action, note: note || undefined } }),
    onSuccess: () => {
      toast.success("Problem updated");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["problems"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const actions = allowedProblemActions(p.status);

  return (
    <div className="space-y-6">
      <Link to="/admin/problems" search={{ status: p.status, q: undefined, page: undefined }} className="text-sm text-muted-foreground hover:text-foreground">← Problems</Link>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <article className="min-w-0 space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ProblemStatusBadge status={p.status} />
              <span className="font-mono text-xs text-muted-foreground">{p.reference_id}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold">{p.title}</h1>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="whitespace-pre-line text-sm leading-relaxed">{p.description}</p>
            {p.additional_info && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="eyebrow text-muted-foreground">Additional information</p>
                <p className="mt-1 whitespace-pre-line text-sm">{p.additional_info}</p>
              </div>
            )}
          </div>
          {p.media.length > 0 && <MediaList media={p.media} />}

          <section>
            <h2 className="mb-3 font-semibold">Solutions ({data.solutions.length})</h2>
            {data.solutions.length ? (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
                {data.solutions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link to="/admin/solutions/$solutionId" params={{ solutionId: s.id }} className="font-medium hover:text-primary">{s.title}</Link>
                      <p className="text-xs text-muted-foreground">by {s.author} · {formatDate(s.created_at)}</p>
                    </div>
                    <SolutionStatusBadge status={s["status"]} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No solutions yet.</p>
            )}
          </section>
        </article>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <dl className="space-y-2 text-sm">
              <Row label="Category">{p.category ?? "—"}</Row>
              <Row label="Location">{p.location ?? "—"}</Row>
              <Row label="Contact email">{p.contact_email ? <a href={`mailto:${p.contact_email}`} className="text-primary hover:underline">{p.contact_email}</a> : "—"}</Row>
              <Row label="Submitted">{formatDateTime(p.created_at)}</Row>
              <Row label="Published">{formatDateTime(p.published_at)}</Row>
              <Row label="Active solvers">{p.solverCount}</Row>
              <Row label="Claimed">{p.claimedAt ? `${p.claimedBy} · ${formatDate(p.claimedAt)}` : "Not yet"}</Row>
            </dl>
          </div>
          <div className="stamp rounded-xl bg-card p-5">
            <h2 className="font-semibold">Review</h2>
            {actions.length ? (
              <>
                <Label htmlFor="note" className="mt-3 block text-xs text-muted-foreground">Internal note (saved in the audit log)</Label>
                <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className="mt-1" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {actions.map((a) => (
                    <Button key={a} size="sm" variant={VARIANT[a]} disabled={act.isPending} onClick={() => act.mutate(a)}>
                      {a === "approve" && p.status === "RESOLVED" ? "Reopen" : PROBLEM_ACTION_LABEL[a]}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No actions available.</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-semibold">History</h2>
            <ReviewHistory items={data.history} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  );
}
