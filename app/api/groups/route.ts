import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, ok, requireUser } from "@/lib/api";
import { createGroupSchema } from "@/lib/validators";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: user.id } } },
    include: {
      members: { include: { user: true } },
      _count: { select: { expenses: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return ok({ groups });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      createdById: user.id,
      members: {
        create: { userId: user.id, role: "OWNER" }
      }
    },
    include: { members: { include: { user: true } } }
  });

  return ok({ group }, { status: 201 });
}
