import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/dashboard/side-nav";
import { Pager } from "@/components/site/pager";
import { EmptyState, PageError } from "@/components/site/empty-state";
import { adminUsersQuery } from "@/lib/queries";
import { adminSetUserRole } from "@/lib/admin.functions";
import { errorMessage, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/users")({
  validateSearch: (s: Record<string, unknown>): { q?: string | undefined; page?: number | undefined } => ({
    q: typeof s["q"] === "string" && s["q"].trim() ? s["q"].slice(0, 200) : undefined,
    page: Number(s["page"]) > 1 ? Math.floor(Number(s["page"])) : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, page: search.page ?? 1 }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(adminUsersQuery(deps)),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: AdminUsers,
});

function AdminUsers() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/users" });
  const { data } = useSuspenseQuery(adminUsersQuery({ q: search.q, page: search.page ?? 1 }));
  const [q, setQ] = useState(search.q ?? "");
  const qc = useQueryClient();
  const roleFn = useServerFn(adminSetUserRole);
  const setRole = useMutation({
    mutationFn: (v: { userId: string; makeAdmin: boolean }) => roleFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.makeAdmin ? "Admin access granted" : "Admin access removed");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    navigate({ search: { q: q.trim() || undefined, page: undefined } });
  }

  return (
    <>
      <PageTitle eyebrow="People" title="Users">{data.total} registered accounts.</PageTitle>
      <form onSubmit={submit} className="mb-4 flex max-w-md gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" maxLength={200} aria-label="Search users" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {data.users.length ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Joined</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Solutions</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.users.map((u) => {
                const isAdmin = u.roles.includes("admin");
                const self = u.id === data.selfId;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name || "—"}{self && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">{formatDate(u.created_at)}</td>
                    <td className="hidden px-4 py-3 font-mono md:table-cell">{u.solutions}</td>
                    <td className="px-4 py-3">{isAdmin ? <Badge variant="signal">Admin</Badge> : <Badge variant="muted">Solver</Badge>}</td>
                    <td className="px-4 py-3 text-right">
                      {!self && (
                        <Button
                          size="sm"
                          variant={isAdmin ? "ghost" : "outline"}
                          disabled={setRole.isPending}
                          onClick={() => {
                            if (window.confirm(isAdmin ? `Remove admin access from ${u.email}?` : `Give ${u.email} full admin access?`)) {
                              setRole.mutate({ userId: u.id, makeAdmin: !isAdmin });
                            }
                          }}
                        >
                          {isAdmin ? "Remove admin" : "Make admin"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No users found" />
      )}
      <Pager page={data.page} pageCount={data.pageCount} onPage={(p) => navigate({ search: (prev) => ({ ...prev, page: p > 1 ? p : undefined }) })} />
    </>
  );
}
