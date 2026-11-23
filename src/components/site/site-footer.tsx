import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Real problems from real people, matched with solvers who build answers. Every problem and solution is reviewed before it goes public.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="eyebrow text-muted-foreground">Platform</p>
          <Link to="/problems" className="block hover:underline">Explore problems</Link>
          <Link to="/solved" className="block hover:underline">Solved problems</Link>
          <Link to="/submit" className="block hover:underline">Submit a problem</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="eyebrow text-muted-foreground">Solvers</p>
          <Link to="/auth" search={{ redirect: undefined, mode: "signup" }} className="block hover:underline">Create an account</Link>
          <Link to="/dashboard" className="block hover:underline">My dashboard</Link>
          <Link to="/dashboard/claim" className="block hover:underline">Claim a problem you posted</Link>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SolveBridge
      </div>
    </footer>
  );
}
