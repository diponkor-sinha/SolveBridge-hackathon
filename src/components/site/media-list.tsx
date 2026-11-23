import { FileText } from "lucide-react";

export function MediaList({ media }: { media: { type: string; url: string | null }[] }) {
  const items = media.filter((m): m is { type: string; url: string } => Boolean(m.url));
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((m, i) =>
        m.type === "application/pdf" ? (
          <a
            key={i}
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted text-sm font-medium hover:bg-accent"
          >
            <FileText className="h-7 w-7 text-primary" />
            Open PDF {i + 1}
          </a>
        ) : (
          <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-border">
            <img src={m.url} alt={`Attachment ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform hover:scale-105" />
          </a>
        ),
      )}
    </div>
  );
}
