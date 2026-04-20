// Settlements API. Phase 2 feature, but scaffolded here for completeness
// so the balances endpoint can consume settlements immediately.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  ok,
  requireMember,
  requireUser
} from "@/lib/api";
import { settlementSchema, toBigInt } from "@/lib/validators";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const mem = await requireMember(params.id, user.id);
  if (mem.error) return mem.error;

  const settlements = await prisma.settlement.findMany({
    where: { groupId: params.id },
    include: { from: true, to: true },
    orderBy: { date: "desc" }
  });
  return ok({ settlements });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const mem = await requireMember(params.id, user.id);
  if (mem.error) return mem.error;

  const body = await req.json().catch(() => null);
  const parsed = settlementSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());

  const { fromId, toId, amountPaise, note, date } = parsed.data;
  if (fromId === toId) return badRequest("fromId and toId must differ");

  const members = await prisma.groupMember.findMany({
    where: { groupId: params.id, userId: { in: [fromId, toId] } }
  });
  if (members.length !== 2) return badRequest("both parties must be group members");

  const settlement = await prisma.settlement.create({
    data: {
      groupId: params.id,
      fromId,
      toId,
      amountPaise: toBigInt(amountPaise),
      note,
      date: date ? new Date(date) : new Date()
    },
    include: { from: true, to: true }
  });

  return ok({ settlement }, { status: 201 });
}
