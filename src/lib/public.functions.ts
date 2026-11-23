import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import { PAGE_SIZE } from "./constants";
import { problemSubmissionSchema, referenceIdSchema, sanitizeSearch } from "./schemas";
import { generateClaimKey, generateReferenceId, hashClaimKey, toHex, randomBytes } from "./crypto";
import { validateUploads } from "./files";
import {
  clientFingerprint,
  enforceRateLimit,
  getAdminClient,
  getPublicClient,
  serverSecret,
  signPaths,
  verifyTurnstile,
  type DB,
} from "./server-utils.server";

async function solverCounts(client: DB, ids: string[]) {
  const map: Record<string, number> = {};
  if (ids.length === 0) return map;
  const { data } = await client.rpc("active_solver_counts", { _problem_ids: ids });
  for (const row of data ?? []) map[row.problem_id] = Number(row.solver_count);
  return map;
}

async function authorNames(client: DB, ids: string[]) {
  const map: Record<string, string> = {};
  const unique = [...new Set(ids)];
  if (unique.length === 0) return map;
  const { data } = await client.from("profiles").select("id, full_name").in("id", unique);
  for (const p of data ?? []) map[p.id] = p.full_name || "SolveBridge solver";
  return map;
}

const excerpt = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

export const getCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = getPublicClient();
  const { data, error } = await sb.from("problem_categories").select("id, name, slug, description").order("name");
  if (error) throw new Error("Could not load categories.");
  return [...(data ?? [])].sort((a, b) => (a.slug === "other" ? 1 : b.slug === "other" ? -1 : 0));
});

export const getTurnstileSiteKey = createServerFn({ method: "GET" }).handler(async () => {
  // Public by design; the secret half stays server-side.
  const site = process.env["TURNSTILE_SITE_KEY"];
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  return { siteKey: site && secret ? site : null };
});

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = getPublicClient();
  const [problemsCount, solutionsCount, recent, recentSolutions] = await Promise.all([
    sb.from("problems").select("id", { count: "exact", head: true }),
    sb.from("solutions").select("id", { count: "exact", head: true }),
    sb
      .from("problems")
      .select("id, reference_id, title, description, location, status, published_at, created_at, problem_categories(name, slug)")
      .eq("status", "APPROVED")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(6),
    sb
      .from("solutions")
      .select("id, title, solution_type, submitted_by, reviewed_at, problems(reference_id, title)")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(3),
  ]);
  const problems = recent.data ?? [];
  const counts = await solverCounts(sb, problems.map((p) => p.id));
  const names = await authorNames(sb, (recentSolutions.data ?? []).map((s) => s.submitted_by));
  return {
    totalProblems: problemsCount.count ?? 0,
    totalSolutions: solutionsCount.count ?? 0,
    recentProblems: problems.map((p) => ({
      ...p,
      description: excerpt(p.description),
      category: p.problem_categories,
      solverCount: counts[p.id] ?? 0,
    })),
    recentSolutions: (recentSolutions.data ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      solution_type: s.solution_type,
      reviewed_at: s.reviewed_at,
      author: names[s.submitted_by] ?? "SolveBridge solver",
      problem: s.problems,
    })),
  };
});

const listSchema = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(60).optional(),
  page: z.number().int().min(1).max(500).default(1),
});

export const listProblems = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = getPublicClient();
    const from = (data.page - 1) * PAGE_SIZE;
    let query = sb
      .from("problems")
      .select(
        `id, reference_id, title, description, location, status, published_at, created_at, problem_categories${data.category ? "!inner" : ""}(name, slug)`,
        { count: "exact" },
      )
      .in("status", ["APPROVED", "RESOLVED"])
      .order("status", { ascending: true })
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (data.category) query = query.eq("problem_categories.slug", data.category);
    const q = sanitizeSearch(data.q);
    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    const { data: rows, count, error } = await query;
    if (error) {
      console.error("listProblems", error.code);
      throw new Error("Could not load problems.");
    }
    const list = (rows ?? []) as unknown as Array<{
      id: string; reference_id: string; title: string; description: string; location: string | null;
      status: "APPROVED" | "RESOLVED"; published_at: string | null; created_at: string;
      problem_categories: { name: string; slug: string } | null;
    }>;
    const counts = await solverCounts(sb, list.map((p) => p.id));
    return {
      total: count ?? 0,
      page: data.page,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
      problems: list.map((p) => ({
        ...p,
        description: excerpt(p.description),
        category: p.problem_categories,
        solverCount: counts[p.id] ?? 0,
      })),
    };
  });

export const getProblem = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ referenceId: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const parsed = referenceIdSchema.safeParse(data.referenceId);
    if (!parsed.success) throw notFound();
    const sb = getPublicClient();
    const { data: problem } = await sb
      .from("problems")
      .select("id, reference_id, title, description, location, additional_info, status, created_at, published_at, problem_categories(name, slug)")
      .eq("reference_id", parsed.data)
      .maybeSingle();
    if (!problem) throw notFound();

    const [{ data: media }, { data: solutions }, counts] = await Promise.all([
      sb.from("problem_media").select("file_path, file_type").eq("problem_id", problem.id),
      sb
        .from("solutions")
        .select("id, title, description, solution_type, github_url, demo_url, submitted_by, reviewed_at")
        .eq("problem_id", problem.id)
        .order("reviewed_at", { ascending: false }),
      solverCounts(sb, [problem.id]),
    ]);
    const solutionIds = (solutions ?? []).map((s) => s.id);
    const { data: solMedia } = solutionIds.length
      ? await sb.from("solution_media").select("solution_id, file_path, file_type").in("solution_id", solutionIds)
      : { data: [] as { solution_id: string; file_path: string; file_type: string }[] };
    // Paths above come from public-scoped (RLS-filtered) reads; sign them server-side.
    const { supabaseAdmin: signer } = await import("@/integrations/supabase/client.server");
    const [problemUrls, solutionUrls, names] = await Promise.all([
      signPaths(signer, "problem-media", (media ?? []).map((m) => m.file_path)),
      signPaths(signer, "solution-media", (solMedia ?? []).map((m) => m.file_path)),
      authorNames(sb, (solutions ?? []).map((s) => s.submitted_by)),
    ]);

    return {
      problem: {
        id: problem.id,
        reference_id: problem.reference_id,
        title: problem.title,
        description: problem.description,
        location: problem.location,
        additional_info: problem.additional_info,
        status: problem.status,
        created_at: problem.created_at,
        published_at: problem.published_at,
        category: problem.problem_categories,
        solverCount: counts[problem.id] ?? 0,
        media: (media ?? [])
          .map((m) => ({ type: m.file_type, url: problemUrls.get(m.file_path) ?? null }))
          .filter((m) => m.url),
      },
      solutions: (solutions ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        solution_type: s.solution_type,
        github_url: s.github_url,
        demo_url: s.demo_url,
        reviewed_at: s.reviewed_at,
        author: names[s.submitted_by] ?? "SolveBridge solver",
        media: (solMedia ?? [])
          .filter((m) => m.solution_id === s.id)
          .map((m) => ({ type: m.file_type, url: solutionUrls.get(m.file_path) ?? null }))
          .filter((m) => m.url),
      })),
    };
  });

export const listSolved = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ page: z.number().int().min(1).max(500).default(1) }).parse(d))
  .handler(async ({ data }) => {
    const sb = getPublicClient();
    const from = (data.page - 1) * PAGE_SIZE;
    const { data: rows, count, error } = await sb
      .from("solutions")
      .select(
        "id, title, description, solution_type, github_url, demo_url, submitted_by, reviewed_at, problems!inner(id, reference_id, title, description, status, problem_categories(name))",
        { count: "exact" },
      )
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("listSolved", error.code);
      throw new Error("Could not load solved problems.");
    }
    const names = await authorNames(sb, (rows ?? []).map((r) => r.submitted_by));
    return {
      page: data.page,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
      total: count ?? 0,
      solutions: (rows ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        solution_type: r.solution_type,
        github_url: r.github_url,
        demo_url: r.demo_url,
        reviewed_at: r.reviewed_at,
        author: names[r.submitted_by] ?? "SolveBridge solver",
        problem: {
          reference_id: r.problems.reference_id,
          title: r.problems.title,
          description: excerpt(r.problems.description, 260),
          status: r.problems.status,
          category: r.problems.problem_categories?.name ?? null,
        },
      })),
    };
  });

export const submitProblem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Invalid submission.");
    return d;
  })
  .handler(async ({ data: form }) => {
    const str = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" ? v : undefined;
    };
    // Honeypot: real people never fill this hidden field.
    if (str("website")) throw new Error("Submission could not be accepted.");

    const fp = await clientFingerprint();
    await enforceRateLimit(`submit-problem:${fp}`, 5, 60 * 60);
    await verifyTurnstile(str("turnstile_token"));

    const parsed = problemSubmissionSchema.safeParse({
      title: str("title"),
      description: str("description"),
      category_id: str("category_id"),
      location: str("location"),
      contact_email: str("contact_email"),
      additional_info: str("additional_info"),
    });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form.");
    const input = parsed.data;

    const files = await validateUploads(form.getAll("files").filter((f): f is File => f instanceof File));

    const pub = getPublicClient();
    const { data: category } = await pub.from("problem_categories").select("id").eq("id", input.category_id).maybeSingle();
    if (!category) throw new Error("Choose a valid category.");

    const admin = await getAdminClient();
    const claimKey = generateClaimKey();
    const tokenHash = await hashClaimKey(serverSecret(), claimKey);

    let problem: { id: string; reference_id: string } | null = null;
    for (let attempt = 0; attempt < 4 && !problem; attempt++) {
      const { data: row, error } = await admin
        .from("problems")
        .insert({
          reference_id: generateReferenceId(),
          title: input.title,
          description: input.description,
          category_id: input.category_id,
          location: input.location ?? null,
          contact_email: input.contact_email ?? null,
          additional_info: input.additional_info ?? null,
          status: "PENDING_REVIEW",
        })
        .select("id, reference_id")
        .single();
      if (row) problem = row;
      else if (error?.code !== "23505") {
        console.error("submitProblem insert", error?.code);
        throw new Error("Could not save your problem. Please try again.");
      }
    }
    if (!problem) throw new Error("Could not save your problem. Please try again.");

    const { error: claimError } = await admin.from("problem_claims").insert({ problem_id: problem.id, token_hash: tokenHash });
    if (claimError) {
      console.error("claim insert", claimError.code);
      await admin.from("problems").delete().eq("id", problem.id);
      throw new Error("Could not save your problem. Please try again.");
    }

    let uploaded = 0;
    for (const file of files) {
      const path = `${problem.id}/${toHex(randomBytes(16))}.${file.ext}`;
      const { error } = await admin.storage.from("problem-media").upload(path, file.bytes, { contentType: file.type, upsert: false });
      if (error) {
        console.error("problem media upload", error.message);
        continue;
      }
      await admin.from("problem_media").insert({ problem_id: problem.id, file_path: path, file_type: file.type });
      uploaded++;
    }

    return { referenceId: problem.reference_id, claimKey, filesSaved: uploaded, filesSent: files.length };
  });
