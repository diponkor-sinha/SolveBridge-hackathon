import { z } from "zod";
import { SOLUTION_TYPES } from "./constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), { message: "Use a full https:// link" });

export const problemSubmissionSchema = z.object({
  title: z.string().trim().min(5, "Title needs at least 5 characters").max(150),
  description: z.string().trim().min(20, "Describe the problem in at least 20 characters").max(5000),
  category_id: z.string().uuid("Choose a category"),
  location: optionalText(150),
  contact_email: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || z.string().email().safeParse(v).success, { message: "Enter a valid email" }),
  additional_info: optionalText(2000),
});
export type ProblemSubmissionInput = z.input<typeof problemSubmissionSchema>;

export const solutionSchema = z.object({
  title: z.string().trim().min(5, "Title needs at least 5 characters").max(150),
  description: z.string().trim().min(20, "Explain your solution in at least 20 characters").max(10000),
  solution_type: z.enum(SOLUTION_TYPES.map((t) => t.value) as [string, ...string[]]),
  github_url: httpsUrl,
  demo_url: httpsUrl,
});

export const referenceIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^SB-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Reference IDs look like SB-7K3M-9QX2");

export const claimSchema = z.object({
  referenceId: referenceIdSchema,
  claimKey: z.string().trim().min(20).max(200),
});

export const profileSchema = z.object({
  full_name: z.string().trim().max(100).optional().transform((v) => v || null),
  bio: z.string().trim().max(1000).optional().transform((v) => v || null),
});

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
  description: z.string().trim().max(300).optional().transform((v) => v || null),
  is_active: z.boolean(),
});

/** Strip characters that would change the meaning of a PostgREST filter. */
export function sanitizeSearch(q: string | undefined) {
  if (!q) return "";
  return q.replace(/[,()*%\\:"'.]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
