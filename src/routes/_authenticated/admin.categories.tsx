import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageTitle } from "@/components/dashboard/side-nav";
import { PageError } from "@/components/site/empty-state";
import { adminCategoriesQuery } from "@/lib/queries";
import { adminSaveCategory } from "@/lib/admin.functions";
import { categorySchema } from "@/lib/schemas";
import { errorMessage } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminCategoriesQuery),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: Categories,
});

type Cat = { id?: string; name: string; slug: string; description: string | null; is_active: boolean };
const EMPTY: Cat = { name: "", slug: "", description: "", is_active: true };
const slugify = (s: string) => s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

function Categories() {
  const { data } = useSuspenseQuery(adminCategoriesQuery);
  const qc = useQueryClient();
  const saveFn = useServerFn(adminSaveCategory);
  const [editing, setEditing] = useState<Cat>(EMPTY);
  const save = useMutation({
    mutationFn: (c: Cat) => saveFn({ data: { ...c, description: c.description ?? undefined } }),
    onSuccess: () => {
      toast.success("Category saved");
      setEditing(EMPTY);
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = categorySchema.safeParse({ ...editing, description: editing.description || undefined });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the category details."); return; }
    save.mutate(editing);
  }

  return (
    <>
      <PageTitle eyebrow="Settings" title="Categories">Hidden categories disappear from the submit form and filters; existing problems keep them.</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{c.name} {!c.is_active && <Badge variant="muted" className="ml-1">Hidden</Badge>}</p>
                <p className="truncate text-xs text-muted-foreground"><span className="font-mono">{c.slug}</span> · {c.problemCount} problems{c.description ? ` · ${c.description}` : ""}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name, slug: c.slug, description: c.description, is_active: c.is_active })}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className="stamp h-fit space-y-4 rounded-xl bg-card p-5">
          <h2 className="font-semibold">{editing.id ? "Edit category" : "New category"}</h2>
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input
              id="c-name"
              value={editing.name}
              maxLength={60}
              onChange={(e) => setEditing((c) => ({ ...c, name: e.target.value, slug: c.id ? c.slug : slugify(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-slug">Short name (used in links)</Label>
            <Input id="c-slug" value={editing.slug} maxLength={60} className="font-mono" onChange={(e) => setEditing((c) => ({ ...c, slug: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Description</Label>
            <Input id="c-desc" value={editing.description ?? ""} maxLength={300} onChange={(e) => setEditing((c) => ({ ...c, description: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="c-active" checked={editing.is_active} onCheckedChange={(v) => setEditing((c) => ({ ...c, is_active: v }))} />
            <Label htmlFor="c-active">Visible to the public</Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>Save</Button>
            {editing.id && <Button type="button" variant="ghost" onClick={() => setEditing(EMPTY)}>Cancel</Button>}
          </div>
        </form>
      </div>
    </>
  );
}
