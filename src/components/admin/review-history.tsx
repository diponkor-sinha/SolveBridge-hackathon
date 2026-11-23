import { actionLabel } from "./audit-label";
import { formatDateTime } from "@/lib/format";

export function ReviewHistory({ items }: { items: { id: string; admin: string; action: string; feedback: string | null; created_at: string }[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No review actions yet.</p>;
  return (
    <ol className="space-y-3 text-sm">
      {items.map((h) => (
        <li key={h.id} className="border-l-2 border-primary/40 pl-3">
          <p><span className="font-medium">{h.admin}</span> {actionLabel(h.action)}</p>
          {h.feedback && <p className="mt-0.5 whitespace-pre-line text-muted-foreground">“{h.feedback}”</p>}
          <p className="font-mono text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
        </li>
      ))}
    </ol>
  );
}
