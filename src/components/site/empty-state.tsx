import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageError({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="mx-auto max-w-xl rounded-xl border border-destructive/30 bg-destructive-soft px-6 py-8 text-center">
      <h2 className="text-lg font-semibold text-destructive">This didn't load</h2>
      <p className="mt-2 text-sm text-foreground/80">{msg}</p>
    </div>
  );
}
