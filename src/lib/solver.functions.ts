import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { claimSchema, profileSchema, solutionSchema } from "./schemas";
import { hashClaimKey, randomBytes, timingSafeEqual, toHex } from "./crypto";
import { validateUploads, type ValidatedFile } from "./files";
import { MAX_FILES_PER_SUBMISSION } from "./constants";
import {
  clientFingerprint,
  enforceRateLimit,
  getAdminClient,
  serverSecret,
  signPaths,
  type DB,
} from "./server-utils.server";

const idInput = z.object({ problemId: z.string().uuid() });

export const getMySelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: sel }, { data: sols }] = await Promise.all([
      context.supabase
        .from("problem_selections")
        .select("id, withdrawn_at")
        .eq("problem_id", data.problemId)
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("solutions")
        .select("id, status")
        .eq("problem_id", data.problemId)
        .eq("submitted_by", context.userId)
        .order("created_at", { ascending: false }),
    ]);
    const active = (sols ?? []).find((s) => s["status"] !== "REJECTED") ?? null;
    return { selected: Boolean(sel && !sel.withdrawn_at), solution: active };
  });

export const selectProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await enforceRateLimit(`select:${context.userId}`, 30, 60 * 60);
    const { data: existing } = await context.supabase
      .from("problem_selections")
      .select("id, withdrawn_at")
      .eq("problem_id", data.problemId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing && !existing.withdrawn_at) throw new Error("You have already chosen this problem.");
    if (existing) {
      const { data: rows, error } = await context.supabase
        .from("problem_selections")
        .update({ withdrawn_at: null })
        .eq("id", existing.id)
        .select("id");
      if (error || !rows?.length) throw new Error("This problem is not open for new solvers.");
    } else {
      const { error } = await context.supabase
        .from("problem_selections")
        .insert({ problem_id: data.problemId, user_id: context.userId });
      if (error) {
        if (error.code === "23505") throw new Error("You have already chosen this problem.");
        throw new Error("This problem is not open for new solvers.");
      }
    }
    return { ok: true };
  });

export const withdrawSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("problem_selections")
      .update({ withdrawn_at: new Date().toISOString() })
      .eq("problem_id", data.problemId)
      .eq("user_id", context.userId)
      .is("withdrawn_at", null)
      .select("id");
    if (error) throw new Error("Could not withdraw. Please try again.");
    if (!rows?.length) throw new Error("You haven't chosen this problem.");
    return { ok: true };
  });

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [selections, solutions, claimed, profile] = await Promise.all([
      sb
        .from("problem_selections")
        .select("id, problem_id, created_at, withdrawn_at, problems(id, reference_id, title, status, problem_categories(name))")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
      sb
        .from("solutions")
        .select("id, problem_id, title, solution_type, status, admin_feedback, created_at, updated_at, reviewed_at, problems(reference_id, title)")
        .eq("submitted_by", context.userId)
        .order("updated_at", { ascending: false }),
      sb.rpc("my_claimed_problems"),
      sb.from("profiles").select("full_name, bio, avatar_url").eq("id", context.userId).maybeSingle(),
    ]);
    const sols = solutions.data ?? [];
    return {
      profile: profile.data ?? { full_name: null, bio: null, avatar_url: null },
      selections: (selections.data ?? []).map((s) => {
        const solution = sols.find((x) => x.problem_id === s.problem_id && x.status !== "REJECTED") ?? null;
        return {
          id: s.id,
          problemId: s.problem_id,
          active: !s.withdrawn_at,
          created_at: s.created_at,
          withdrawn_at: s.withdrawn_at,
          problem: s.problems
            ? {
                reference_id: s.problems.reference_id,
                title: s.problems.title,
                status: s.problems.status,
                category: s.problems.problem_categories?.name ?? null,
              }
            : null,
          solution: solution ? { id: solution.id, status: solution.status } : null,
        };
      }),
      solutions: sols.map((s) => ({
        id: s.id,
        title: s.title,
        solution_type: s.solution_type,
        status: s["status"],
        admin_feedback: s.admin_feedback,
        created_at: s.created_at,
        updated_at: s.updated_at,
        reviewed_at: s.reviewed_at,
        problem: s.problems,
      })),
      claimedProblems: claimed.data ?? [],
    };
  });

export const getSolveContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ referenceId: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: problem } = await context.supabase
      .from("problems")
      .select("id, reference_id, title, description, status")
      .eq("reference_id", data.referenceId.toUpperCase())
      .maybeSingle();
    if (!problem) throw new Error("Problem not found or not open.");
    const { data: sel } = await context.supabase
      .from("problem_selections")
      .select("withdrawn_at")
      .eq("problem_id", problem.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: sols } = await context.supabase
      .from("solutions")
      .select("id, status")
      .eq("problem_id", problem.id)
      .eq("submitted_by", context.userId);
    const active = (sols ?? []).find((s) => s["status"] !== "REJECTED") ?? null;
    return { problem, selected: Boolean(sel && !sel.withdrawn_at), activeSolution: active };
  });

async function uploadSolutionFiles(sb: DB, userId: string, solutionId: string, files: ValidatedFile[]) {
  let saved = 0;
  for (const file of files) {
    const path = `${userId}/${solutionId}/${toHex(randomBytes(16))}.${file.ext}`;
    const { error } = await sb.storage.from("solution-media").upload(path, file.bytes, { contentType: file.type, upsert: false });
    if (error) {
      console.error("solution media upload", error.message);
      continue;
    }
    const { error: rowError } = await sb.from("solution_media").insert({ solution_id: solutionId, file_path: path, file_type: file.type });
    if (!rowError) saved++;
  }
  return saved;
}

function readSolutionForm(form: FormData) {
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = solutionSchema.safeParse({
    title: str("title"),
    description: str("description"),
    solution_type: str("solution_type"),
    github_url: str("github_url"),
    demo_url: str("demo_url"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form.");
  return { values: parsed.data, str };
}

const formInput = (d: unknown) => {
  if (!(d instanceof FormData)) throw new Error("Invalid submission.");
  return d;
};

export const submitSolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(formInput)
  .handler(async ({ data: form, context }) => {
    const { values, str } = readSolutionForm(form);
    const problemId = z.string().uuid().safeParse(str("problem_id"));
    if (!problemId.success) throw new Error("Invalid problem.");
    await enforceRateLimit(`solution:${context.userId}`, 10, 60 * 60);
    const files = await validateUploads(form.getAll("files").filter((f): f is File => f instanceof File));

    const { data: row, error } = await context.supabase
      .from("solutions")
      .insert({
        problem_id: problemId.data,
        submitted_by: context.userId,
        title: values.title,
        description: values.description,
        solution_type: values.solution_type,
        github_url: values.github_url ?? null,
        demo_url: values.demo_url ?? null,
      })
      .select("id")
      .single();
    if (error || !row) {
      if (error?.code === "23505") throw new Error("You already have an active solution for this problem.");
      throw new Error("Choose this problem first — solutions can only be submitted for problems you're working on.");
    }
    const saved = await uploadSolutionFiles(context.supabase, context.userId, row.id, files);
    return { id: row.id, filesSaved: saved, filesSent: files.length };
  });

export const getMySolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ solutionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase
      .from("solutions")
      .select("id, problem_id, title, description, solution_type, github_url, demo_url, status, admin_feedback, created_at, updated_at, reviewed_at, problems(reference_id, title)")
      .eq("id", data.solutionId)
      .eq("submitted_by", context.userId)
      .maybeSingle();
    if (!s) throw new Error("Solution not found.");
    const { data: media } = await context.supabase
      .from("solution_media")
      .select("id, file_path, file_type")
      .eq("solution_id", s.id);
    const urls = await signPaths(context.supabase, "solution-media", (media ?? []).map((m) => m.file_path));
    return {
      ...s,
      media: (media ?? []).map((m) => ({ id: m.id, type: m.file_type, url: urls.get(m.file_path) ?? null })),
    };
  });

export const updateSolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(formInput)
  .handler(async ({ data: form, context }) => {
    const { values, str } = readSolutionForm(form);
    const solutionId = z.string().uuid().safeParse(str("solution_id"));
    if (!solutionId.success) throw new Error("Invalid solution.");
    await enforceRateLimit(`solution-edit:${context.userId}`, 20, 60 * 60);
    const files = await validateUploads(form.getAll("files").filter((f): f is File => f instanceof File));
    const { count } = await context.supabase
      .from("solution_media")
      .select("id", { count: "exact", head: true })
      .eq("solution_id", solutionId.data);
    if ((count ?? 0) + files.length > MAX_FILES_PER_SUBMISSION) {
      throw new Error(`A solution can have up to ${MAX_FILES_PER_SUBMISSION} files in total.`);
    }
    const { data: rows, error } = await context.supabase
      .from("solutions")
      .update({
        title: values.title,
        description: values.description,
        solution_type: values.solution_type,
        github_url: values.github_url ?? null,
        demo_url: values.demo_url ?? null,
        status: "SUBMITTED",
      })
      .eq("id", solutionId.data)
      .eq("submitted_by", context.userId)
      .select("id");
    if (error || !rows?.length) throw new Error("You can only edit a solution after the reviewer requests changes.");
    const saved = await uploadSolutionFiles(context.supabase, context.userId, solutionId.data, files);
    return { id: solutionId.data, filesSaved: saved, filesSent: files.length };
  });

export const claimProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => claimSchema.parse(d))
  .handler(async ({ data, context }) => {
    const fp = await clientFingerprint();
    await enforceRateLimit(`claim:${context.userId}`, 5, 15 * 60);
    await enforceRateLimit(`claim-ip:${fp}`, 10, 15 * 60);
    const fail = () => new Error("That reference ID and claim key don't match, or the problem was already claimed.");

    const admin = await getAdminClient();
    const { data: problem } = await admin
      .from("problems")
      .select("id, reference_id, submitter_user_id")
      .eq("reference_id", data.referenceId)
      .maybeSingle();
    if (!problem) throw fail();
    const { data: claim } = await admin
      .from("problem_claims")
      .select("id, token_hash, claimed_at")
      .eq("problem_id", problem.id)
      .maybeSingle();
    if (!claim || claim.claimed_at) throw fail();
    const digest = await hashClaimKey(serverSecret(), data.claimKey);
    if (!timingSafeEqual(digest, claim.token_hash)) throw fail();

    // Single use: only succeeds if still unclaimed.
    const { data: updated } = await admin
      .from("problem_claims")
      .update({ claimed_by: context.userId, claimed_at: new Date().toISOString() })
      .eq("id", claim.id)
      .is("claimed_at", null)
      .select("id");
    if (!updated?.length) throw fail();
    await admin.from("problems").update({ submitter_user_id: context.userId }).eq("id", problem.id);
    return { referenceId: problem.reference_id };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name, bio: data.bio })
      .eq("id", context.userId);
    if (error) throw new Error("Could not save your profile.");
    return { ok: true };
  });
