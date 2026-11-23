import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PAGE_SIZE, type ProblemStatus, type SolutionStatus } from "./constants";
import { categorySchema, sanitizeSearch } from "./schemas";
import {
  nextProblemStatus,
  nextSolutionStatus,
  problemAcceptsSolutions,
  solutionFeedbackRequired,
} from "./review-rules";
import { assertAdmin, getAdminClient, logAdminAction, signPaths, type DB } from "./server-utils.server";

const PROBLEM_STATUSES = ["PENDING_REVIEW", "APPROVED", "REJECTED", "RESOLVED", "ARCHIVED"] as const;
const SOLUTION_STATUSES = ["SUBMITTED", "ACCEPTED", "REJECTED", "CHANGES_REQUESTED"] as const;

async function names(admin: DB, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const map: Record<string, string> = {};
  if (!unique.length) return map;
  const { data } = await admin.from("profiles").select("id, full_name").in("id", unique);
  for (const p of data ?? []) map[p.id] = p.full_name || "Unnamed user";
  return map;
}

async function history(admin: DB, targetId: string) {
  const { data } = await admin
    .from("admin_reviews")
    .select("id, admin_id, action, feedback, created_at")
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(30);
  const who = await names(admin, (data ?? []).map((r) => r.admin_id));
  return (data ?? []).map((r) => ({ ...r, admin: who[r.admin_id] ?? "Admin" }));
}

export const checkIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: Boolean(data) };
  });

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const admin = await getAdminClient();
    const countProblems = (s: ProblemStatus) =>
      admin.from("problems").select("id", { count: "exact", head: true }).eq("status", s);
    const countSolutions = (s: SolutionStatus) =>
      admin.from("solutions").select("id", { count: "exact", head: true }).eq("status", s);
    const since = new Date(Date.now() - 13 * 86400_000);
    since.setUTCHours(0, 0, 0, 0);

    const [pStatus, sStatus, users, selections, perCategory, recentProblems, recentSolutions, categories, audit] =
      await Promise.all([
        Promise.all(PROBLEM_STATUSES.map(countProblems)),
        Promise.all(SOLUTION_STATUSES.map(countSolutions)),
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.from("problem_selections").select("id", { count: "exact", head: true }).is("withdrawn_at", null),
        admin.from("problems").select("category_id").limit(10000),
        admin.from("problems").select("created_at").gte("created_at", since.toISOString()).limit(10000),
        admin.from("solutions").select("created_at").gte("created_at", since.toISOString()).limit(10000),
        admin.from("problem_categories").select("id, name"),
        admin.from("admin_reviews").select("id, admin_id, target_type, action, created_at").order("created_at", { ascending: false }).limit(8),
      ]);

    const problemCounts = Object.fromEntries(PROBLEM_STATUSES.map((s, i) => [s, pStatus[i]?.count ?? 0])) as Record<ProblemStatus, number>;
    const solutionCounts = Object.fromEntries(SOLUTION_STATUSES.map((s, i) => [s, sStatus[i]?.count ?? 0])) as Record<SolutionStatus, number>;

    const catName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
    const byCat = new Map<string, number>();
    for (const p of perCategory.data ?? []) {
      const n = catName.get(p.category_id) ?? "Unknown";
      byCat.set(n, (byCat.get(n) ?? 0) + 1);
    }

    const days: { day: string; problems: number; solutions: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(since.getTime() + i * 86400_000);
      days.push({ day: d.toISOString().slice(0, 10), problems: 0, solutions: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.day, i]));
    for (const r of recentProblems.data ?? []) {
      const i = idx.get(r.created_at.slice(0, 10));
      if (i !== undefined) days[i]!.problems++;
    }
    for (const r of recentSolutions.data ?? []) {
      const i = idx.get(r.created_at.slice(0, 10));
      if (i !== undefined) days[i]!.solutions++;
    }

    const who = await names(admin, (audit.data ?? []).map((a) => a.admin_id));
    return {
      problemCounts,
      solutionCounts,
      totalUsers: users.count ?? 0,
      activeSelections: selections.count ?? 0,
      byCategory: [...byCat.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      activity: days,
      recentAudit: (audit.data ?? []).map((a) => ({ ...a, admin: who[a.admin_id] ?? "Admin" })),
    };
  });

const listProblemsInput = z.object({
  status: z.enum(PROBLEM_STATUSES).default("PENDING_REVIEW"),
  q: z.string().max(200).optional(),
  page: z.number().int().min(1).max(1000).default(1),
});

export const adminListProblems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listProblemsInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdminClient();
    const from = (data.page - 1) * PAGE_SIZE;
    let query = admin
      .from("problems")
      .select("id, reference_id, title, location, status, created_at, published_at, submitter_user_id, problem_categories(name)", { count: "exact" })
      .eq("status", data.status)
      .order("created_at", { ascending: data.status === "PENDING_REVIEW" })
      .range(from, from + PAGE_SIZE - 1);
    const q = sanitizeSearch(data.q);
    if (q) query = query.or(`title.ilike.%${q}%,reference_id.ilike.%${q}%,description.ilike.%${q}%`);
    const { data: rows, count, error } = await query;
    if (error) throw new Error("Could not load problems.");
    const ids = (rows ?? []).map((r) => r.id);
    const { data: sols } = ids.length
      ? await admin.from("solutions").select("problem_id").in("problem_id", ids)
      : { data: [] as { problem_id: string }[] };
    const solCount: Record<string, number> = {};
    for (const s of sols ?? []) solCount[s.problem_id] = (solCount[s.problem_id] ?? 0) + 1;
    return {
      total: count ?? 0,
      page: data.page,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
      problems: (rows ?? []).map((r) => ({
        id: r.id,
        reference_id: r.reference_id,
        title: r.title,
        location: r.location,
        status: r.status,
        created_at: r.created_at,
        published_at: r.published_at,
        claimed: Boolean(r.submitter_user_id),
        category: r.problem_categories?.name ?? null,
        solutionCount: solCount[r.id] ?? 0,
      })),
    };
  });

export const adminGetProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdminClient();
    const { data: p } = await admin
      .from("problems")
      .select("id, reference_id, title, description, location, contact_email, additional_info, status, created_at, published_at, updated_at, submitter_user_id, problem_categories(name)")
      .eq("id", data.id)
      .maybeSingle();
    if (!p) throw new Error("Problem not found.");
    const [{ data: media }, { data: claim }, { data: sols }, { data: counts }, log] = await Promise.all([
      admin.from("problem_media").select("file_path, file_type").eq("problem_id", p.id),
      admin.from("problem_claims").select("claimed_at").eq("problem_id", p.id).maybeSingle(),
      admin.from("solutions").select("id, title, status, submitted_by, created_at").eq("problem_id", p.id).order("created_at", { ascending: false }),
      admin.rpc("active_solver_counts", { _problem_ids: [p.id] }),
      history(admin, p.id),
    ]);
    const urls = await signPaths(admin, "problem-media", (media ?? []).map((m) => m.file_path));
    const who = await names(admin, [...(sols ?? []).map((s) => s.submitted_by), p.submitter_user_id]);
    return {
      problem: {
        id: p.id,
        reference_id: p.reference_id,
        title: p.title,
        description: p.description,
        location: p.location,
        contact_email: p.contact_email,
        additional_info: p.additional_info,
        status: p.status,
        created_at: p.created_at,
        published_at: p.published_at,
        updated_at: p.updated_at,
        category: p.problem_categories?.name ?? null,
        claimedAt: claim?.claimed_at ?? null,
        claimedBy: p.submitter_user_id ? (who[p.submitter_user_id] ?? "Registered user") : null,
        solverCount: Number(counts?.[0]?.solver_count ?? 0),
        media: (media ?? []).map((m) => ({ type: m.file_type, url: urls.get(m.file_path) ?? null })).filter((m) => m.url),
      },
      solutions: (sols ?? []).map((s) => ({ ...s, author: who[s.submitted_by] ?? "Unnamed user" })),
      history: log,
    };
  });

export const adminSetProblemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approve", "reject", "resolve", "archive"]),
        note: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdminClient();
    const { data: p } = await admin.from("problems").select("id, status, published_at").eq("id", data.id).maybeSingle();
    if (!p) throw new Error("Problem not found.");
    const next = nextProblemStatus(p.status, data.action);
    if (!next) throw new Error("That action isn't available for this problem right now.");
    const patch: { status: ProblemStatus; published_at?: string } = { status: next };
    if (next === "APPROVED" && !p.published_at) patch.published_at = new Date().toISOString();
    const { data: rows, error } = await admin.from("problems").update(patch).eq("id", p.id).eq("status", p.status).select("id");
    if (error || !rows?.length) throw new Error("The problem changed while you were reviewing it. Refresh and try again.");
    await logAdminAction(admin, {
      adminId: context.userId,
      targetType: "problem",
      targetId: p.id,
      action: `problem.${data.action}`,
      feedback: data.note || null,
    });
    return { status: next };
  });

const listSolutionsInput = z.object({
  status: z.enum(SOLUTION_STATUSES).default("SUBMITTED"),
  page: z.number().int().min(1).max(1000).default(1),
});

export const adminListSolutions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSolutionsInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdminClient();
    const from = (data.page - 1) * PAGE_SIZE;
    const { data: rows, count, error } = await admin
      .from("solutions")
      .select("id, title, solution_type, status, submitted_by, created_at, updated_at, reviewed_at, problems(id, reference_id, title)", { count: "exact" })
      .eq("status", data.status)
      .order("updated_at", { ascending: data.status === "SUBMITTED" })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("Could not load solutions.");
    const who = await names(admin, (rows ?? []).map((r) => r.submitted_by));
    return {
      total: count ?? 0,
      page: data.page,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
      solutions: (rows ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        solution_type: r.solution_type,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        reviewed_at: r.reviewed_at,
        author: who[r.submitted_by] ?? "Unnamed user",
        problem: r.problems,
      })),
    };
  });

export const adminGetSolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdminClient();
    const { data: s } = await admin
      .from("solutions")
      .select("id, title, description, solution_type, github_url, demo_url, status, admin_feedback, submitted_by, created_at, updated_at, reviewed_at, problems(id, reference_id, title, status)")
      .eq("id", data.id)
      .maybeSingle();
    if (!s) throw new Error("Solution not found.");
    const [{ data: media }, log, who, authUser] = await Promise.all([
      admin.from("solution_media").select("file_path, file_type").eq("solution_id", s.id),
      history(admin, s.id),
      names(admin, [s.submitted_by]),
      admin.auth.admin.getUserById(s.submitted_by),
    ]);
    const urls = await signPaths(admin, "solution-media", (media ?? []).map((m) => m.file_path));
    return {
      solution: {
        ...s,
        author: who[s.submitted_by] ?? "Unnamed user",
        authorEmail: authUser.data.user?.email ?? null,
        media: (media ?? []).map((m) => ({ type: m.file_type, url: urls.get(m.file_path) ?? null })).filter((m) => m.url),
      },
      history: log,
    };
  });

export const adminReviewSolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["accept", "reject", "request_changes"]),
        feedback: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (solutionFeedbackRequired(data.action) && !data.feedback) {
      throw new Error("Add feedback so the solver knows what to change.");
    }
    const admin = await getAdminClient();
    const { data: s } = await admin.from("solutions").select("id, status, problems(status)").eq("id", data.id).maybeSingle();
    if (!s) throw new Error("Solution not found.");
    const next = nextSolutionStatus(s["status"], data.action);
    if (!next) throw new Error("That action isn't available for this solution right now.");
    if (next === "ACCEPTED" && (!s.problems || !problemAcceptsSolutions(s.problems.status))) {
      throw new Error("Publish the problem before accepting a solution for it.");
    }
    const { data: rows, error } = await admin
      .from("solutions")
      .update({ status: next, admin_feedback: data.feedback || null, reviewed_at: new Date().toISOString() })
      .eq("id", s.id)
      .eq("status", s["status"])
      .select("id");
    if (error || !rows?.length) throw new Error("The solution changed while you were reviewing it. Refresh and try again.");
    await logAdminAction(admin, {
      adminId: context.userId,
      targetType: "solution",
      targetId: s.id,
      action: `solution.${data.action}`,
      feedback: data.feedback || null,
    });
    return { status: next };
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(200).optional(), page: z.number().int().min(1).max(1000).default(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdminClient();
    const perPage = 25;
    const q = data.q?.trim().toLowerCase();
    const res = q
      ? await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      : await admin.auth.admin.listUsers({ page: data.page, perPage });
    if (res.error) throw new Error("Could not load users.");
    let users = res.data.users;
    const ids = users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }, { data: sols }] = await Promise.all([
      ids.length ? admin.from("profiles").select("id, full_name").in("id", ids) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      ids.length ? admin.from("user_roles").select("user_id, role").in("user_id", ids) : Promise.resolve({ data: [] as { user_id: string; role: "admin" | "solver" }[] }),
      ids.length ? admin.from("solutions").select("submitted_by").in("submitted_by", ids) : Promise.resolve({ data: [] as { submitted_by: string }[] }),
    ]);
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    if (q) {
      users = users.filter((u) => (u.email ?? "").toLowerCase().includes(q) || (nameOf.get(u.id) ?? "").toLowerCase().includes(q));
    }
    const total = q ? users.length : ((res.data as { total?: number }).total ?? users.length);
    if (q) users = users.slice((data.page - 1) * perPage, data.page * perPage);
    const solCount: Record<string, number> = {};
    for (const s of sols ?? []) solCount[s.submitted_by] = (solCount[s.submitted_by] ?? 0) + 1;
    return {
      page: data.page,
      pageCount: Math.max(1, Math.ceil(total / perPage)),
      total,
      selfId: context.userId,
      users: users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        name: nameOf.get(u.id) ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role),
        solutions: solCount[u.id] ?? 0,
      })),
    };
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && !data.makeAdmin) {
      throw new Error("You can't remove your own admin access.");
    }
    const admin = await getAdminClient();
    if (data.makeAdmin) {
      const { error } = await admin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) throw new Error("Could not update the role.");
    } else {
      const { error } = await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw new Error("Could not update the role.");
    }
    await logAdminAction(admin, {
      adminId: context.userId,
      targetType: "user",
      targetId: data.userId,
      action: data.makeAdmin ? "user.grant_admin" : "user.revoke_admin",
    });
    return { ok: true };
  });

export const adminListCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const admin = await getAdminClient();
    const [{ data: cats }, { data: probs }] = await Promise.all([
      admin.from("problem_categories").select("id, name, slug, description, is_active, created_at").order("name"),
      admin.from("problems").select("category_id").limit(10000),
    ]);
    const count: Record<string, number> = {};
    for (const p of probs ?? []) count[p.category_id] = (count[p.category_id] ?? 0) + 1;
    return (cats ?? []).map((c) => ({ ...c, problemCount: count[c.id] ?? 0 }));
  });

export const adminSaveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => categorySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdminClient();
    const values = { name: data.name, slug: data.slug, description: data.description, is_active: data.is_active };
    const res = data.id
      ? await admin.from("problem_categories").update(values).eq("id", data.id).select("id").single()
      : await admin.from("problem_categories").insert(values).select("id").single();
    if (res.error || !res.data) {
      if (res.error?.code === "23505") throw new Error("A category with that name or short name already exists.");
      throw new Error("Could not save the category.");
    }
    await logAdminAction(admin, {
      adminId: context.userId,
      targetType: "category",
      targetId: res.data.id,
      action: data.id ? "category.update" : "category.create",
      feedback: `${data.name}${data.is_active ? "" : " (hidden)"}`,
    });
    return { id: res.data.id };
  });

export const adminListAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        page: z.number().int().min(1).max(1000).default(1),
        type: z.enum(["problem", "solution", "user", "category"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdminClient();
    const perPage = 30;
    const from = (data.page - 1) * perPage;
    let query = admin
      .from("admin_reviews")
      .select("id, admin_id, target_type, target_id, action, feedback, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + perPage - 1);
    if (data.type) query = query.eq("target_type", data.type);
    const { data: rows, count, error } = await query;
    if (error) throw new Error("Could not load the audit log.");
    const list = rows ?? [];
    const idsOf = (t: string) => list.filter((r) => r.target_type === t).map((r) => r.target_id);
    const [who, probs, sols, cats] = await Promise.all([
      names(admin, [...list.map((r) => r.admin_id), ...idsOf("user")]),
      idsOf("problem").length ? admin.from("problems").select("id, reference_id, title").in("id", idsOf("problem")) : Promise.resolve({ data: [] as { id: string; reference_id: string; title: string }[] }),
      idsOf("solution").length ? admin.from("solutions").select("id, title").in("id", idsOf("solution")) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      idsOf("category").length ? admin.from("problem_categories").select("id, name").in("id", idsOf("category")) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const label = (r: (typeof list)[number]) => {
      if (r.target_type === "problem") {
        const p = (probs.data ?? []).find((x) => x.id === r.target_id);
        return p ? `${p.reference_id} · ${p.title}` : "Deleted problem";
      }
      if (r.target_type === "solution") return (sols.data ?? []).find((x) => x.id === r.target_id)?.title ?? "Deleted solution";
      if (r.target_type === "category") return (cats.data ?? []).find((x) => x.id === r.target_id)?.name ?? "Category";
      return who[r.target_id] ?? "User";
    };
    return {
      page: data.page,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / perPage)),
      total: count ?? 0,
      entries: list.map((r) => ({
        id: r.id,
        admin: who[r.admin_id] ?? "Admin",
        target_type: r.target_type,
        target_id: r.target_id,
        target: label(r),
        action: r.action,
        feedback: r.feedback,
        created_at: r.created_at,
      })),
    };
  });
