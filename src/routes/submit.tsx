import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cloneElement, isValidElement, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilePicker } from "@/components/site/file-picker";
import { Turnstile } from "@/components/site/turnstile";
import { PageError } from "@/components/site/empty-state";
import { categoriesQuery } from "@/lib/queries";
import { getTurnstileSiteKey, submitProblem } from "@/lib/public.functions";
import { problemSubmissionSchema } from "@/lib/schemas";
import { MAX_FILES_PER_SUBMISSION } from "@/lib/constants";
import { errorMessage } from "@/lib/format";

const turnstileQuery = queryOptions({ queryKey: ["turnstile-site-key"], queryFn: () => getTurnstileSiteKey(), staleTime: 10 * 60_000 });

export const Route = createFileRoute("/submit")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(categoriesQuery), context.queryClient.ensureQueryData(turnstileQuery)]),
  head: () => ({
    meta: [
      { title: "Submit a problem anonymously — SolveBridge" },
      { name: "description", content: "Describe a real-world problem without creating an account. Reviewed problems are published for solvers." },
      { property: "og:title", content: "Submit a problem anonymously — SolveBridge" },
      { property: "og:description", content: "Describe a real-world problem without an account. Reviewed problems are published for solvers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => <div className="px-4 py-16"><PageError error={error} /></div>,
  component: SubmitPage,
});

type Result = { referenceId: string; claimKey: string; filesSaved: number; filesSent: number };

function SubmitPage() {
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: ts } = useSuspenseQuery(turnstileQuery);
  const submitFn = useServerFn(submitProblem);
  const [category, setCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);

  const mutation = useMutation({
    mutationFn: (fd: FormData) => submitFn({ data: fd }),
    onSuccess: (r) => {
      setResult(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setResetSignal((n) => n + 1);
      setToken(null);
    },
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("category_id", category);
    const parsed = problemSubmissionSchema.safeParse({
      title: fd.get("title"),
      description: fd.get("description"),
      category_id: category,
      location: fd.get("location") || undefined,
      contact_email: fd.get("contact_email") || undefined,
      additional_info: fd.get("additional_info") || undefined,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    if (ts.siteKey && !token) { toast.error("Please complete the security check."); return; }
    fd.delete("files");
    for (const f of files) fd.append("files", f);
    if (token) fd.set("turnstile_token", token);
    mutation.mutate(fd);
  }

  if (result) return <Confirmation result={result} />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="eyebrow text-primary">Anonymous submission</p>
      <h1 className="mt-2 text-4xl font-bold">Submit a problem</h1>
      <p className="mt-2 text-muted-foreground">
        No account needed. Our team reviews every problem before it's published — your contact email is never shown publicly.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8" noValidate>
        <Field id="title" label="Problem title" required error={errors["title"]}>
          <Input id="title" name="title" maxLength={150} placeholder="e.g. Village school has no clean drinking water" />
        </Field>
        <Field id="description" label="Describe the problem" required error={errors["description"]} hint="Who is affected, what happens today, what you've tried.">
          <Textarea id="description" name="description" rows={7} maxLength={5000} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="category" label="Category" required error={errors["category_id"]}>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="location" label="Location" error={errors["location"]} hint="Optional — town, region or country">
            <Input id="location" name="location" maxLength={150} />
          </Field>
        </div>
        <Field id="contact_email" label="Contact email" error={errors["contact_email"]} hint="Optional — only reviewers can see it">
          <Input id="contact_email" name="contact_email" type="email" maxLength={255} />
        </Field>
        <Field id="additional_info" label="Additional information" error={errors["additional_info"]} hint="Optional">
          <Textarea id="additional_info" name="additional_info" rows={3} maxLength={2000} />
        </Field>
        <div className="space-y-1.5">
          <Label>Supporting images or documents</Label>
          <FilePicker files={files} onChange={setFiles} max={MAX_FILES_PER_SUBMISSION} />
        </div>
        {/* Honeypot: hidden from people, tempting for bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        {ts.siteKey && <Turnstile siteKey={ts.siteKey} onToken={setToken} resetSignal={resetSignal} />}
        <Button type="submit" variant="signal" size="lg" disabled={mutation.isPending} className="w-full sm:w-auto">
          {mutation.isPending ? "Submitting…" : "Submit problem"}
        </Button>
      </form>
    </div>
  );
}

function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string | undefined; hint?: string; children: ReactNode }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control =
    isValidElement(children) && (children.type === Input || children.type === Textarea)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        })
      : children;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {control}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Confirmation({ result }: { result: Result }) {
  const [copied, setCopied] = useState(false);
  const text = `SolveBridge problem credentials\n\nReference ID: ${result.referenceId}\nClaim key: ${result.claimKey}\n\nKeep the claim key private. You need both to link this problem to an account later at ${typeof window !== "undefined" ? window.location.origin : ""}/dashboard/claim\nIf the claim key is lost it cannot be recovered.\n`;

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Credentials copied");
    setTimeout(() => setCopied(false), 2000);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `solvebridge-${result.referenceId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <div className="stamp rounded-2xl bg-card p-8">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success"><Check className="h-6 w-6" /></div>
        <h1 className="mt-4 text-3xl font-bold">Problem received</h1>
        <p className="mt-2 text-muted-foreground">Thank you! It's now waiting for review and will appear in the directory once approved.</p>
        {result.filesSent > result.filesSaved && (
          <p className="mt-3 text-sm text-warning">{result.filesSent - result.filesSaved} attachment(s) could not be saved.</p>
        )}

        <dl className="mt-6 space-y-3">
          <div className="rounded-lg bg-muted p-4">
            <dt className="eyebrow text-muted-foreground">Reference ID</dt>
            <dd className="mt-1 font-mono text-xl font-semibold">{result.referenceId}</dd>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <dt className="eyebrow text-muted-foreground">Secret claim key</dt>
            <dd className="mt-1 break-all font-mono text-sm">{result.claimKey}</dd>
          </div>
        </dl>

        <div className="mt-5 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>Save the claim key somewhere private now. It's shown only once and <strong>cannot be recovered</strong> if lost. You'll need it to link this problem to an account.</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => void copy()}>{copied ? <Check /> : <Copy />} Copy credentials</Button>
          <Button variant="outline" onClick={download}><Download /> Download as file</Button>
        </div>
        <div className="mt-8 flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
          <Link to="/submit" reloadDocument className="font-medium text-primary hover:underline">Submit another problem</Link>
          <Link to="/problems" search={{ q: undefined, category: undefined, page: undefined }} className="font-medium text-primary hover:underline">Explore problems</Link>
        </div>
      </div>
    </div>
  );
}
