import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2" aria-label="SolveBridge home">
      <span className="stamp grid h-8 w-8 place-items-center rounded-md bg-signal text-signal-foreground">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M2 17h20M4 17V11M20 17V11M4 11c3-5 13-5 16 0M8 17v-4M12 17v-5M16 17v-4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-foreground">SolveBridge</span>
    </Link>
  );
}
