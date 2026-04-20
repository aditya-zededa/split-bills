import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  notFound,
  ok,
  requireMember,
  requireOwner,
  requireUser
} from "@/lib/api";
import { renameGroupSchema } from "@/lib/validators";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const mem = await requireMember(params.id, user.id);
  if (mem.error) return mem.error;

  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: {
      members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
      expenses: {
        orderBy: { date: "desc" },
        take: 20,
        include: {
          payer: true,
          shares: { include: { user: true } }
        }
      },
      settlements: {
        orderBy: { date: "desc" },
        take: 10,
        include: { from: true, to: true }
      },
      invites: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!group) return notFound("group");
  return ok({ group });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const own = await requireOwner(params.id, user.id);
  if (own.error) return own.error;

  const body = await req.json().catch(() => null);
  const parsed = renameGroupSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());

  const group = await prisma.group.update({
    where: { id: params.id },
    data: { name: parsed.data.name }
  });

  return ok({ group });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const own = await requireOwner(params.id, user.id);
  if (own.error) return own.error;

  await prisma.group.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
