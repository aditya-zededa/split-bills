import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional()
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(80)
});

export const renameGroupSchema = z.object({
  name: z.string().min(1).max(80)
});

export const inviteSchema = z.object({
  email: z.string().email().toLowerCase()
});

export const acceptInviteSchema = z.object({
  token: z.string().min(8)
});

export const customShareSchema = z.object({
  userId: z.string().min(1),
  value: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
});

export const createExpenseSchema = z
  .object({
    payerId: z.string().min(1),
    amountPaise: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
    description: z.string().min(1).max(200),
    date: z.string().datetime().optional(),
    splitMode: z.enum(["EQUAL", "AMOUNT", "PERCENT"]),
    participants: z.array(z.string().min(1)).min(1),
    customShares: z.array(customShareSchema).nullish(),
    source: z.enum(["MANUAL", "AUDIO"]).default("MANUAL"),
    audioTranscript: z.string().optional()
  })
  .refine(
    (v) =>
      v.splitMode === "EQUAL" ||
      (Array.isArray(v.customShares) && v.customShares.length > 0),
    { message: "customShares required for AMOUNT/PERCENT" }
  );

export const updateExpenseSchema = createExpenseSchema.innerType().partial();

export const settlementSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  amountPaise: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  note: z.string().max(200).optional(),
  date: z.string().datetime().optional()
});

export function toBigInt(v: number | string): bigint {
  return typeof v === "number" ? BigInt(v) : BigInt(v);
}
