import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number };

export function SideNav({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <nav aria-label={title} className="lg:sticky lg:top-24 lg:self-start">
      <p className="eyebrow mb-3 hidden text-muted-foreground lg:block">{title}</p>
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => (
          <li key={item.to} className="shrink-0">
            <Link
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-primary-soft text-foreground" }}
            >
              <item.icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{item.label}</span>
              {item.badge ? (
                <span className="ml-auto rounded-full bg-signal px-1.5 font-mono text-[11px] font-semibold text-signal-foreground">{item.badge}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="eyebrow text-primary">{eyebrow}</p>}
      <h1 className="mt-1 text-3xl font-bold">{title}</h1>
      {children && <p className="mt-1 text-muted-foreground">{children}</p>}
    </div>
  );
}

export function StatCard({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "signal" | "success" | "warning" }) {
  const toneCls = {
    default: "bg-card",
    signal: "bg-signal-soft",
    success: "bg-success-soft",
    warning: "bg-warning-soft",
  }[tone];
  return (
    <div className={`rounded-xl border border-border p-4 shadow-card ${toneCls}`}>
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}
