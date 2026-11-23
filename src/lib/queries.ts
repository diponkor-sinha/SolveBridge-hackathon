import { queryOptions } from "@tanstack/react-query";
import { getCategories, getHomeData, getProblem, listProblems, listSolved } from "./public.functions";
import { getDashboard, getMySolution, getSolveContext } from "./solver.functions";
import {
  adminGetProblem,
  adminGetSolution,
  adminListAudit,
  adminListCategories,
  adminListProblems,
  adminListSolutions,
  adminListUsers,
  getAdminOverview,
} from "./admin.functions";
import type { ProblemStatus, SolutionStatus } from "./constants";

export const categoriesQuery = queryOptions({ queryKey: ["categories"], queryFn: () => getCategories(), staleTime: 5 * 60_000 });
export const homeQuery = queryOptions({ queryKey: ["home"], queryFn: () => getHomeData(), staleTime: 30_000 });
export const problemsQuery = (s: { q?: string | undefined; category?: string | undefined; page: number }) =>
  queryOptions({ queryKey: ["problems", s], queryFn: () => listProblems({ data: s }), staleTime: 30_000 });
export const problemQuery = (referenceId: string) =>
  queryOptions({ queryKey: ["problem", referenceId], queryFn: () => getProblem({ data: { referenceId } }), staleTime: 15_000 });
export const solvedQuery = (page: number) =>
  queryOptions({ queryKey: ["solved", page], queryFn: () => listSolved({ data: { page } }), staleTime: 30_000 });

export const dashboardQuery = queryOptions({ queryKey: ["me", "dashboard"], queryFn: () => getDashboard() });
export const mySolutionQuery = (solutionId: string) =>
  queryOptions({ queryKey: ["me", "solution", solutionId], queryFn: () => getMySolution({ data: { solutionId } }) });
export const solveContextQuery = (referenceId: string) =>
  queryOptions({ queryKey: ["me", "solve", referenceId], queryFn: () => getSolveContext({ data: { referenceId } }) });

export const adminOverviewQuery = queryOptions({ queryKey: ["admin", "overview"], queryFn: () => getAdminOverview() });
export const adminProblemsQuery = (s: { status: ProblemStatus; q?: string | undefined; page: number }) =>
  queryOptions({ queryKey: ["admin", "problems", s], queryFn: () => adminListProblems({ data: s }) });
export const adminProblemQuery = (id: string) =>
  queryOptions({ queryKey: ["admin", "problem", id], queryFn: () => adminGetProblem({ data: { id } }) });
export const adminSolutionsQuery = (s: { status: SolutionStatus; page: number }) =>
  queryOptions({ queryKey: ["admin", "solutions", s], queryFn: () => adminListSolutions({ data: s }) });
export const adminSolutionQuery = (id: string) =>
  queryOptions({ queryKey: ["admin", "solution", id], queryFn: () => adminGetSolution({ data: { id } }) });
export const adminUsersQuery = (s: { q?: string | undefined; page: number }) =>
  queryOptions({ queryKey: ["admin", "users", s], queryFn: () => adminListUsers({ data: s }) });
export const adminCategoriesQuery = queryOptions({ queryKey: ["admin", "categories"], queryFn: () => adminListCategories() });
export const adminAuditQuery = (s: { page: number; type?: "problem" | "solution" | "user" | "category" | undefined }) =>
  queryOptions({ queryKey: ["admin", "audit", s], queryFn: () => adminListAudit({ data: s }) });
