import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — SolveBridge" },
      { name: "description", content: "Get a link to set a new SolveBridge password." },
      { property: "og:title", content: "Reset your password — SolveBridge" },
      { property: "og:description", content: "Get a link to set a new SolveBridge password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) { toast.error("Couldn't send the link. Please try again in a minute."); return; }
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-lift">
        <h1 className="text-2xl font-bold">Forgot your password?</h1>
        {sent ? (
          <p className="mt-3 text-sm text-muted-foreground">If an account exists for that email, a reset link is on its way. Check your inbox.</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <p className="text-sm text-muted-foreground">Enter your email and we'll send you a link to set a new password.</p>
            <div className="space-y-1.5">
              <Label htmlFor="fp-email">Email</Label>
              <Input id="fp-email" name="email" type="email" required maxLength={255} autoComplete="email" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>Send reset link</Button>
          </form>
        )}
        <Link to="/auth" search={{ redirect: undefined, mode: undefined }} className="mt-6 inline-block text-sm text-primary hover:underline">Back to sign in</Link>
      </div>
    </div>
  );
}
