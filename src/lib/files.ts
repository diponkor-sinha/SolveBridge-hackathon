import { ALLOWED_UPLOAD_TYPES, MAX_FILE_BYTES, MAX_FILES_PER_SUBMISSION } from "./constants";

export type AllowedType = (typeof ALLOWED_UPLOAD_TYPES)[number];

const EXT: Record<AllowedType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Detect the real file type from its first bytes, ignoring the claimed name/MIME. */
export function sniffFileType(bytes: Uint8Array): AllowedType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "image/webp";
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d)
    return "application/pdf";
  return null;
}

export function extensionFor(type: AllowedType) {
  return EXT[type];
}

const BLOCKED_EXT = /\.(exe|bat|cmd|com|msi|sh|ps1|js|mjs|jar|apk|dll|scr|vbs|html?|svg|php)$/i;

export type ValidatedFile = { bytes: Uint8Array; type: AllowedType; ext: string };

/** Server-side upload validation: count, size, extension blocklist and real content type. */
export async function validateUploads(files: File[]): Promise<ValidatedFile[]> {
  const real = files.filter((f) => f && typeof f === "object" && f.size > 0);
  if (real.length > MAX_FILES_PER_SUBMISSION) {
    throw new Error(`You can attach up to ${MAX_FILES_PER_SUBMISSION} files.`);
  }
  const out: ValidatedFile[] = [];
  for (const file of real) {
    if (file.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" is larger than 5 MB.`);
    if (BLOCKED_EXT.test(file.name)) throw new Error(`"${file.name}" is not an allowed file type.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffFileType(bytes.subarray(0, 16));
    if (!type) throw new Error(`"${file.name}" must be a JPG, PNG, WEBP image or a PDF.`);
    out.push({ bytes, type, ext: extensionFor(type) });
  }
  return out;
}
