// Pure Web Crypto helpers (runs on the server Worker and in tests).

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no 0/O/1/I/L/U confusion

export function randomBytes(n: number) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function base64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 256-bit secret claim key, shown to the submitter once. */
export function generateClaimKey() {
  return `sbk_${base64url(randomBytes(32))}`;
}

/** Human-friendly public reference, e.g. SB-7K3M-9QX2 (unbiased rejection sampling). */
export function generateReferenceId() {
  const chars: string[] = [];
  const limit = 256 - (256 % REF_ALPHABET.length);
  while (chars.length < 8) {
    for (const b of randomBytes(16)) {
      if (b < limit && chars.length < 8) chars.push(REF_ALPHABET.charAt(b % REF_ALPHABET.length));
    }
  }
  return `SB-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(new Uint8Array(sig));
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashClaimKey(secret: string, claimKey: string) {
  return hmacSha256Hex(secret, `claim-key:v1:${claimKey}`);
}
