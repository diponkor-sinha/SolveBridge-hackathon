import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALLOWED_UPLOAD_ACCEPT, ALLOWED_UPLOAD_TYPES, MAX_FILE_BYTES } from "@/lib/constants";

/** Early browser-side checks only; the server re-validates every file by its content. */
export function FilePicker({ files, onChange, max }: { files: File[]; onChange: (f: File[]) => void; max: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(f.type)) {
        setError(`"${f.name}" must be a JPG, PNG, WEBP or PDF.`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setError(`"${f.name}" is larger than 5 MB.`);
        continue;
      }
      if (next.length >= max) {
        setError(`You can attach up to ${max} files.`);
        break;
      }
      next.push(f);
      setError(null);
    }
    onChange(next);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-2">
      <input ref={input} type="file" multiple accept={ALLOWED_UPLOAD_ACCEPT} className="hidden" onChange={(e) => add(e.target.files)} />
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={files.length >= max}>
        <Paperclip /> Attach images or PDF
      </Button>
      <p className="text-xs text-muted-foreground">Up to {max} files · JPG, PNG, WEBP or PDF · max 5 MB each</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm">
              <span className="truncate">{f.name}</span>
              <button type="button" className="ml-2 text-muted-foreground hover:text-destructive" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
