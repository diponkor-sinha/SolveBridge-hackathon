import { describe, expect, it } from "vitest";
import {
  allowedSolutionActions,
  isPubliclyVisible,
  nextProblemStatus,
  nextSolutionStatus,
  problemAcceptsSolutions,
  solutionFeedbackRequired,
} from "@/lib/review-rules";
import { generateClaimKey, generateReferenceId, hashClaimKey, timingSafeEqual } from "@/lib/crypto";
import { sniffFileType, validateUploads } from "@/lib/files";
import { claimSchema, problemSubmissionSchema, referenceIdSchema, sanitizeSearch, solutionSchema } from "@/lib/schemas";
import { MAX_FILE_BYTES } from "@/lib/constants";

describe("problem moderation", () => {
  it("approving a pending problem publishes it", () => {
    expect(nextProblemStatus("PENDING_REVIEW", "approve")).toBe("APPROVED");
  });
  it("rejecting a pending problem sets REJECTED", () => {
    expect(nextProblemStatus("PENDING_REVIEW", "reject")).toBe("REJECTED");
  });
  it("a pending problem cannot be marked resolved directly", () => {
    expect(nextProblemStatus("PENDING_REVIEW", "resolve")).toBeNull();
  });
  it("pending, rejected and archived problems never show publicly", () => {
    expect(isPubliclyVisible("PENDING_REVIEW")).toBe(false);
    expect(isPubliclyVisible("REJECTED")).toBe(false);
    expect(isPubliclyVisible("ARCHIVED")).toBe(false);
    expect(isPubliclyVisible("APPROVED")).toBe(true);
    expect(isPubliclyVisible("RESOLVED")).toBe(true);
  });
});

describe("solution review", () => {
  it("accept, reject and request changes from SUBMITTED", () => {
    expect(nextSolutionStatus("SUBMITTED", "accept")).toBe("ACCEPTED");
    expect(nextSolutionStatus("SUBMITTED", "reject")).toBe("REJECTED");
    expect(nextSolutionStatus("SUBMITTED", "request_changes")).toBe("CHANGES_REQUESTED");
  });
  it("a solution waiting on changes cannot be accepted until resubmitted", () => {
    expect(nextSolutionStatus("CHANGES_REQUESTED", "accept")).toBeNull();
  });
  it("a rejected solution has no further actions", () => {
    expect(allowedSolutionActions("REJECTED")).toEqual([]);
  });
  it("reject and request changes need feedback; accept does not", () => {
    expect(solutionFeedbackRequired("reject")).toBe(true);
    expect(solutionFeedbackRequired("request_changes")).toBe(true);
    expect(solutionFeedbackRequired("accept")).toBe(false);
  });
  it("accepting a solution does not resolve the problem, and needs a published problem", () => {
    expect(problemAcceptsSolutions("PENDING_REVIEW")).toBe(false);
    expect(problemAcceptsSolutions("APPROVED")).toBe(true);
  });
});

describe("credentials", () => {
  it("claim keys carry 256 bits (32 random bytes) and are unique", () => {
    const a = generateClaimKey();
    const b = generateClaimKey();
    expect(a).toMatch(/^sbk_[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
  it("reference IDs match the public format", () => {
    for (let i = 0; i < 50; i++) expect(referenceIdSchema.safeParse(generateReferenceId()).success).toBe(true);
  });
  it("only a keyed digest of the claim key is stored, and it verifies", async () => {
    const key = generateClaimKey();
    const digest = await hashClaimKey("secret-1", key);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(key);
    expect(timingSafeEqual(digest, await hashClaimKey("secret-1", key))).toBe(true);
    expect(timingSafeEqual(digest, await hashClaimKey("secret-2", key))).toBe(false);
  });
  it("claim form requires a valid reference ID", () => {
    expect(claimSchema.safeParse({ referenceId: "nope", claimKey: generateClaimKey() }).success).toBe(false);
  });
});

describe("uploads", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  it("detects real file type from content, not name", () => {
    expect(sniffFileType(png)).toBe("image/png");
    expect(sniffFileType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  });
  it("rejects a renamed HTML file posing as an image", async () => {
    const fake = new File(["<html></html>"], "photo.png", { type: "image/png" });
    await expect(validateUploads([fake])).rejects.toThrow();
  });
  it("rejects files over 5 MB", async () => {
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "big.png", { type: "image/png" });
    await expect(validateUploads([big])).rejects.toThrow(/5 MB/);
  });
  it("allows at most 3 files", async () => {
    const f = () => new File([png], "a.png", { type: "image/png" });
    await expect(validateUploads([f(), f(), f(), f()])).rejects.toThrow(/up to 3/);
  });
});

describe("form validation", () => {
  it("problem needs title, description and category", () => {
    expect(problemSubmissionSchema.safeParse({ title: "Hi", description: "short", category_id: "x" }).success).toBe(false);
  });
  it("solution links must be https", () => {
    const base = { title: "Solar pump kit", description: "A low-cost solar pump for the village well.", solution_type: "HARDWARE" };
    expect(solutionSchema.safeParse({ ...base, github_url: "http://example.com" }).success).toBe(false);
    expect(solutionSchema.safeParse({ ...base, github_url: "https://github.com/a/b" }).success).toBe(true);
  });
  it("search text cannot inject filter syntax", () => {
    expect(sanitizeSearch("water),status.eq.PENDING_REVIEW")).not.toMatch(/[(),.]/);
  });
});
