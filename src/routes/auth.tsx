import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleButton } from "@/components/site/google-button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { safeRedirect, useAuth } from "@/lib/auth";

type AuthSearch = { redirect?: string | undefined; mode?: "signin" | "signup" | undefined };
const NEXT_KEY = "sb:next";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
    mode: s["mode"] === "signup" ? "signup" : s["mode"] === "signin" ? "signin" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in or join — SolveBridge" },
      { name: "description", content: "Sign in to SolveBridge to choose problems, submit solutions and track reviews." },
      { property: "og:title", content: "Sign in or join — SolveBridge" },
      { property: "og:description", content: "Sign in to SolveBridge to choose problems, submit solutions and track reviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(NEXT_KEY) : null;
    sessionStorage.removeItem(NEXT_KEY);
    navigate({ to: safeRedirect(search.redirect ?? stored ?? undefined), replace: true });
  }, [user, loading, search.redirect, navigate]);

  async function social(provider: "google") {
    setBusy(true);
    sessionStorage.setItem(NEXT_KEY, safeRedirect(search.redirect));
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth` });
    if (result.error) {
      toast.error("Sign-in didn't complete. Please try again.");
      setBusy(false);
    }
  }

  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    setBusy(false);
    if (error) toast.error(error.message === "Email not confirmed" ? "Please confirm your email first — check your inbox." : "Wrong email or password.");
  }

  async function signUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    if (password.length < 8) { toast.error("Use at least 8 characters for your password."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: String(f.get("full_name") || "").slice(0, 100) } },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!data.session) setSentTo(email);
  }

  return (
    <div className="paper-grain">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
        <div className="hidden flex-col justify-center md:flex">
          <p className="eyebrow text-primary">For solvers</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-balance">Pick a real problem. Build the answer.</h1>
          <p className="mt-4 text-muted-foreground">
            Your account lets you choose problems, submit solutions, see reviewer feedback and claim problems you posted anonymously.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Just want to report a problem?{" "}
            <Link to="/submit" className="font-medium text-primary underline-offset-4 hover:underline">No account needed</Link>.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift sm:p-8">
          {sentTo ? (
            <div className="space-y-3 py-6 text-center">
              <h2 className="text-2xl font-bold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium text-foreground">{sentTo}</span>. Open it to finish creating your account.
              </p>
              <Button variant="outline" onClick={() => setSentTo(null)}>Back to sign in</Button>
            </div>
          ) : (
            <Tabs defaultValue={search.mode === "signup" ? "signup" : "signin"}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <div className="mt-6 space-y-2">
                <GoogleButton onClick={() => void social("google")} disabled={busy} />
              </div>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
              </div>

              <TabsContent value="signin">
                <form className="space-y-4" onSubmit={signIn}>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" name="email" type="email" autoComplete="email" required maxLength={255} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="si-password">Password</Label>
                      <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                    </div>
                    <Input id="si-password" name="password" type="password" autoComplete="current-password" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>Sign in</Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-4" onSubmit={signUp}>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Your name</Label>
                    <Input id="su-name" name="full_name" autoComplete="name" maxLength={100} placeholder="Shown on accepted solutions" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" name="email" type="email" autoComplete="email" required maxLength={255} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
                    <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>Create account</Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
