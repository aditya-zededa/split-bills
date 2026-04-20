import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, ok, requireUser } from "@/lib/api";
import { acceptInviteSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = acceptInviteSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());

  const invite = await prisma.invite.findUnique({
    where: { token: parsed.data.token }
  });
  if (!invite) return notFound("invite");
  if (invite.status !== "PENDING") return badRequest("invite not pending");

  // Gentle: allow mismatched email but warn. Plan says must sign in, not necessarily same email.
  // Keeping strict for correctness — an invite is aimed at a specific email.
  if (
    user.email &&
    invite.email.toLowerCase() !== user.email.toLowerCase()
  ) {
    return badRequest("invite email does not match signed-in user");
  }

  const [member] = await prisma.$transaction([
    prisma.groupMember.upsert({
      where: {
        groupId_userId: { groupId: invite.groupId, userId: user.id }
      },
      update: {},
      create: {
        groupId: invite.groupId,
        userId: user.id,
        role: "MEMBER"
      }
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" }
    })
  ]);

  return ok({ groupId: invite.groupId, member });
}
