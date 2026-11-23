import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle } from "@/components/dashboard/side-nav";
import { PageError } from "@/components/site/empty-state";
import { dashboardQuery } from "@/lib/queries";
import { updateProfile } from "@/lib/solver.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({ meta: [{ title: "Account settings — SolveBridge" }, { name: "robots", content: "noindex" }] }),
  errorComponent: ({ error }) => <PageError error={error} />,
  component: Settings,
});

function Settings() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const { user } = useAuth();
  const qc = useQueryClient();
  const saveFn = useServerFn(updateProfile);
  const save = useMutation({
    mutationFn: (v: { full_name?: string; bio?: string }) => saveFn({ data: v }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const [pwBusy, setPwBusy] = useState(false);
  const hasPassword = user?.app_metadata?.providers?.includes("email") ?? user?.app_metadata?.provider === "email";

  function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({ full_name: String(f.get("full_name") ?? ""), bio: String(f.get("bio") ?? "") });
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const password = String(f.get("password"));
    if (password.length < 8) { toast.error("Use at least 8 characters."); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password, current_password: String(f.get("current")) } as { password: string });
    setPwBusy(false);
    if (error) { toast.error(error.message); return; }
    form.reset();
    toast.success("Password changed");
  }

  return (
    <>
      <PageTitle eyebrow="Account" title="Account settings" />
      <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-semibold">Public profile</h2>
        <p className="text-sm text-muted-foreground">Your name appears next to your accepted solutions. Leave it empty to show “SolveBridge solver”.</p>
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Display name</Label>
          <Input id="p-name" name="full_name" defaultValue={data.profile.full_name ?? ""} maxLength={100} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-bio">About you</Label>
          <Textarea id="p-bio" name="bio" rows={3} defaultValue={data.profile.bio ?? ""} maxLength={1000} />
        </div>
        <Button type="submit" disabled={save.isPending}>Save profile</Button>
      </form>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-semibold">Sign-in</h2>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as <span className="font-medium text-foreground">{user?.email}</span></p>
        {hasPassword ? (
          <form onSubmit={changePassword} className="mt-4 grid gap-4 sm:max-w-sm">
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">Current password</Label>
              <Input id="pw-current" name="current" type="password" required autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">New password</Label>
              <Input id="pw-new" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <Button type="submit" variant="outline" disabled={pwBusy}>Change password</Button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">You sign in with Google or Lovable, so there's no password to change here.</p>
        )}
      </div>
    </>
  );
}
