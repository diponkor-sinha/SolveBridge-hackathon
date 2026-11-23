import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageTitle } from "@/components/dashboard/side-nav";
import { PageError } from "@/components/site/empty-state";
import { ProblemStatusBadge } from "@/components/site/status-badge";
import { dashboardQuery } from "@/lib/queries";
import { claimProblem } from "@/lib/solver.functions";
import { claimSchema } from "@/lib/schemas";
import { errorMessage, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/claim")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({ meta: [{ title: "Claim a problem — SolveBridge" }, { name: "robots", content: "noindex" }] }),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: Claim,
});

function Claim() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const qc = useQueryClient();
  const claimFn = useServerFn(claimProblem);
  const claim = useMutation({
    mutationFn: (v: { referenceId: string; claimKey: string }) => claimFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`${r.referenceId} is now linked to your account`);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const parsed = claimSchema.safeParse({ referenceId: f.get("referenceId"), claimKey: f.get("claimKey") });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the reference ID and claim key."); return; }
    claim.mutate(parsed.data, { onSuccess: () => form.reset() });
  }

  return (
    <>
      <PageTitle eyebrow="Submitted anonymously?" title="Claim a problem">
        Link a problem you posted to this account using its reference ID and secret claim key. Each key works once.
      </PageTitle>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="space-y-1.5">
          <Label htmlFor="c-ref">Reference ID</Label>
          <Input id="c-ref" name="referenceId" placeholder="SB-7K3M-9QX2" className="font-mono uppercase" maxLength={20} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-key">Claim key</Label>
          <Input id="c-key" name="claimKey" type="password" placeholder="sbk_…" className="font-mono" maxLength={200} autoComplete="off" />
        </div>
        <Button type="submit" disabled={claim.isPending}>Claim problem</Button>
      </form>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Problems you've claimed</h2>
        {data.claimedProblems.length ? (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {data.claimedProblems.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  {p.status === "APPROVED" || p.status === "RESOLVED" ? (
                    <Link to="/problems/$referenceId" params={{ referenceId: p.reference_id }} className="font-medium hover:text-primary">{p.title}</Link>
                  ) : (
                    <span className="font-medium">{p.title}</span>
                  )}
                  <p className="font-mono text-xs text-muted-foreground">{p.reference_id} · {formatDate(p.created_at)}</p>
                </div>
                <ProblemStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
        )}
      </section>
    </>
  );
}
