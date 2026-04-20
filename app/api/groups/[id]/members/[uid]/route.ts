import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, ok, requireUser } from "@/lib/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; uid: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const caller = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.id } }
  });
  if (!caller) return badRequest("not a group member");

  // Allowed: self-leave, or owner removing another.
  const isSelf = params.uid === user.id;
  const isOwner = caller.role === "OWNER";
  if (!isSelf && !isOwner) {
    return badRequest("owner only");
  }

  const target = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: params.uid } }
  });
  if (!target) return notFound("member");

  // Don't leave group owner-less. If removing the owner, bail unless another owner exists.
  if (target.role === "OWNER") {
    const owners = await prisma.groupMember.count({
      where: { groupId: params.id, role: "OWNER" }
    });
    if (owners <= 1) return badRequest("cannot remove sole owner");
  }

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId: params.id, userId: params.uid } }
  });

  return ok({ removed: true });
}
