import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilePicker } from "@/components/site/file-picker";
import { MAX_FILES_PER_SUBMISSION, SOLUTION_TYPES } from "@/lib/constants";
import { solutionSchema } from "@/lib/schemas";

export type SolutionDefaults = {
  title?: string;
  description?: string;
  solution_type?: string;
  github_url?: string | null;
  demo_url?: string | null;
};

export function SolutionForm({
  defaults,
  hidden,
  submitLabel,
  pending,
  existingFiles = 0,
  onSubmit,
}: {
  defaults?: SolutionDefaults;
  hidden: Record<string, string>;
  submitLabel: string;
  pending: boolean;
  existingFiles?: number;
  onSubmit: (fd: FormData) => void;
}) {
  const [type, setType] = useState(defaults?.solution_type ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("solution_type", type);
    const parsed = solutionSchema.safeParse({
      title: fd.get("title"),
      description: fd.get("description"),
      solution_type: type,
      github_url: fd.get("github_url") || undefined,
      demo_url: fd.get("demo_url") || undefined,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.path[0] === "solution_type" ? "Choose a solution type" : i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
    fd.delete("files");
    for (const f of files) fd.append("files", f);
    onSubmit(fd);
  }

  const err = (k: string) => (errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null);

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="space-y-1.5">
        <Label htmlFor="s-title">Solution title <span className="text-destructive">*</span></Label>
        <Input id="s-title" name="title" defaultValue={defaults?.title} maxLength={150} />
        {err("title")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-desc">How does it solve the problem? <span className="text-destructive">*</span></Label>
        <Textarea id="s-desc" name="description" rows={9} defaultValue={defaults?.description} maxLength={10000} />
        {err("description")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-type">Solution type <span className="text-destructive">*</span></Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="s-type" className="sm:w-72"><SelectValue placeholder="Choose a type" /></SelectTrigger>
          <SelectContent>
            {SOLUTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {err("solution_type")}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="s-gh">Code repository link</Label>
          <Input id="s-gh" name="github_url" type="url" placeholder="https://github.com/…" defaultValue={defaults?.github_url ?? ""} maxLength={500} />
          {err("github_url")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-demo">Live demo link</Label>
          <Input id="s-demo" name="demo_url" type="url" placeholder="https://…" defaultValue={defaults?.demo_url ?? ""} maxLength={500} />
          {err("demo_url")}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Supporting images or documents</Label>
        <FilePicker files={files} onChange={setFiles} max={Math.max(0, MAX_FILES_PER_SUBMISSION - existingFiles)} />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : submitLabel}</Button>
    </form>
  );
}
