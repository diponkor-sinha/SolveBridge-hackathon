import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headers: Record<string, string | undefined> = {};
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => headers[name],
}));

import { getClientIp, verifyTurnstile } from "@/lib/server-utils.server";
import { SECURITY_HEADERS, withSecurityHeaders } from "@/lib/security-headers";
import { generateClaimKey, generateReferenceId, hashClaimKey, timingSafeEqual } from "@/lib/crypto";

beforeEach(() => {
  for (const k of Object.keys(headers)) delete headers[k];
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getClientIp", () => {
  it("prefers the Cloudflare header and trims it", () => {
    headers["cf-connecting-ip"] = " 1.2.3.4 ";
    headers["x-forwarded-for"] = "9.9.9.9";
    vi.stubEnv("NODE_ENV", "production");
    expect(getClientIp()).toBe("1.2.3.4");
  });
  it("ignores spoofable x-forwarded-for in production", () => {
    headers["x-forwarded-for"] = "9.9.9.9";
    vi.stubEnv("NODE_ENV", "production");
    expect(getClientIp()).toBe("unknown");
  });
  it("uses the first x-forwarded-for entry outside production", () => {
    headers["x-forwarded-for"] = "9.9.9.9, 8.8.8.8";
    vi.stubEnv("NODE_ENV", "development");
    expect(getClientIp()).toBe("9.9.9.9");
  });
});

describe("verifyTurnstile", () => {
  it("fails closed in production when the secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    await expect(verifyTurnstile("token")).rejects.toThrow("Security check is not configured.");
  });
  it("is skipped outside production when the secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    await expect(verifyTurnstile(undefined)).resolves.toBeUndefined();
  });
  it("requires a token when the secret is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    await expect(verifyTurnstile(undefined)).rejects.toThrow("Please complete the security check.");
  });
  it("accepts a token Cloudflare reports as valid", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: true }) }));
    await expect(verifyTurnstile("token")).resolves.toBeUndefined();
  });
  it("rejects a token Cloudflare reports as invalid", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }));
    await expect(verifyTurnstile("token")).rejects.toThrow("Security check failed. Please try again.");
  });
});

describe("withSecurityHeaders", () => {
  it("adds baseline headers and keeps status, body and existing headers", async () => {
    const res = withSecurityHeaders(new Response("hello", { status: 201, headers: { "x-custom": "1" } }));
    expect(res.status).toBe(201);
    expect(await res.text()).toBe("hello");
    expect(res.headers.get("x-custom")).toBe("1");
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(name)).toBe(value);
  });
  it("works for bodyless responses such as redirects", () => {
    const res = withSecurityHeaders(new Response(null, { status: 302, headers: { location: "/" } }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("crypto helpers", () => {
  it("reference IDs match the SB-XXXX-XXXX format and avoid confusing characters", () => {
    for (let i = 0; i < 50; i++) expect(generateReferenceId()).toMatch(/^SB-[A-HJKMNP-TV-Z2-9]{4}-[A-HJKMNP-TV-Z2-9]{4}$/);
  });
  it("claim keys are prefixed and unique", () => {
    const a = generateClaimKey();
    expect(a.startsWith("sbk_")).toBe(true);
    expect(a).not.toBe(generateClaimKey());
  });
  it("claim-key hashes are deterministic, 64 hex chars and depend on the secret", async () => {
    const h1 = await hashClaimKey("secret-a", "sbk_x");
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashClaimKey("secret-a", "sbk_x")).toBe(h1);
    expect(await hashClaimKey("secret-b", "sbk_x")).not.toBe(h1);
  });
  it("timingSafeEqual compares strings of equal and different length", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });
});
