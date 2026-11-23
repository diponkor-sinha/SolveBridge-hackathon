// Server-only helpers. Never import from components.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";
import { hmacSha256Hex } from "./crypto";

export type DB = SupabaseClient<Database>;

/** Anonymous-role client for public reads: RLS + column grants decide what is visible. */
export function getPublicClient(): DB {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Privileged client. Only call after the caller is verified (or for the anonymous submit flow). */
export async function getAdminClient(): Promise<DB> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as DB;
}

export function serverSecret() {
  const secret = process.env["CLAIM_KEY_SECRET"];
  if (!secret) throw new Error("Server is not configured. Please try again later.");
  return secret;
}

export function getClientIp() {
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf.trim();
  // Spoofable headers are trusted only outside production (local dev).
  if (process.env["NODE_ENV"] !== "production") {
    const fwd = getRequestHeader("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
  }
  return "unknown";
}

/** Keyed digest of the caller's IP so raw addresses are never stored. */
export async function clientFingerprint() {
  return (await hmacSha256Hex(serverSecret(), `ip:${getClientIp()}`)).slice(0, 32);
}

export async function enforceRateLimit(key: string, max: number, windowSeconds: number) {
  const admin = await getAdminClient();
  const { data, error } = await admin.rpc("check_rate_limit", {
    _key: key,
    _max: max,
    _window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.code);
    throw new Error("Please try again in a moment.");
  }
  if (!data) throw new Error("Too many attempts. Please wait a while and try again.");
}

export function turnstileSecretConfigured() {
  return Boolean(process.env["TURNSTILE_SECRET_KEY"]);
}

export async function verifyTurnstile(token: string | undefined) {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) {
    if (process.env["NODE_ENV"] === "production") throw new Error("Security check is not configured.");
    return; // local dev only
  }
  if (!token) throw new Error("Please complete the security check.");
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  const ip = getClientIp();
  if (ip !== "unknown") body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
  if (!json?.success) throw new Error("Security check failed. Please try again.");
}

type Ctx = { supabase: DB; userId: string };

/** Server-side admin authorization; uses the caller's own token, never the service key. */
export async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: admin access required.");
}

export async function logAdminAction(
  admin: DB,
  entry: { adminId: string; targetType: "problem" | "solution" | "user" | "category"; targetId: string; action: string; feedback?: string | null },
) {
  const { error } = await admin.from("admin_reviews").insert({
    admin_id: entry.adminId,
    target_type: entry.targetType,
    target_id: entry.targetId,
    action: entry.action,
    feedback: entry.feedback ?? null,
  });
  if (error) console.error("audit log insert failed", error.code);
}

export async function signPaths(client: DB, bucket: string, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();
  const { data } = await client.storage.from(bucket).createSignedUrls(paths, 60 * 60);
  const map = new Map<string, string>();
  for (const item of data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  return map;
}
