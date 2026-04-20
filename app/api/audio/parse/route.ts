import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, ok, requireMember, requireUser } from "@/lib/api";
import { parseExpense } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  transcript: z.string().min(1).max(4000),
  groupId: z.string().min(1)
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());

  const { transcript, groupId } = parsed.data;

  const mem = await requireMember(groupId, user.id);
  if (mem.error) return mem.error;

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true }
  });

  try {
    const proposal = await parseExpense(
      transcript,
      members.map((m) => ({
        id: m.user.id,
        name: m.user.name ?? "",
        email: m.user.email
      })),
      user.id
    );
    return ok({ transcript, proposal });
  } catch (e) {
    console.error("[audio/parse] failed", e);
    return badRequest("parser failed", { message: (e as Error).message });
  }
}
