import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  notFound,
  ok,
  requireMember,
  requireUser
} from "@/lib/api";
import { updateExpenseSchema, toBigInt } from "@/lib/validators";
import { computeShares, assertSharesSumToTotal } from "@/lib/split";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const expense = await prisma.expense.findUnique({
    where: { id: params.id },
    include: { payer: true, shares: { include: { user: true } } }
  });
  if (!expense) return notFound("expense");

  const mem = await requireMember(expense.groupId, user.id);
  if (mem.error) return mem.error;

  return ok({ expense });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const existing = await prisma.expense.findUnique({
    where: { id: params.id }
  });
  if (!existing) return notFound("expense");

  const mem = await requireMember(existing.groupId, user.id);
  if (mem.error) return mem.error;

  const body = await req.json().catch(() => null);
  const parsed = updateExpenseSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());

  const patch = parsed.data;

  // If any share-affecting field changed, recompute shares.
  const mustRecompute =
    patch.amountPaise !== undefined ||
    patch.splitMode !== undefined ||
    patch.participants !== undefined ||
    patch.customShares !== undefined;

  let newShares: Array<{ userId: string; sharePaise: bigint }> | null = null;
  let newTotal: bigint | null = null;

  if (mustRecompute) {
    const total = toBigInt(patch.amountPaise ?? Number(existing.amountPaise));
    const splitMode = patch.splitMode ?? existing.splitMode;
    const participants =
      patch.participants ??
      (
        await prisma.expenseShare.findMany({
          where: { expenseId: existing.id },
          select: { userId: true }
        })
      ).map((s) => s.userId);
    const custom = patch.customShares?.map((c) => ({
      userId: c.userId,
      value: toBigInt(c.value)
    }));

    const members = await prisma.groupMember.findMany({
      where: { groupId: existing.groupId },
      select: { userId: true }
    });
    const memberIds = new Set(members.map((m) => m.userId));
    for (const p of participants) {
      if (!memberIds.has(p)) return badRequest(`participant ${p} not in group`);
    }

    try {
      newShares = computeShares({
        total,
        participants,
        mode: splitMode,
        custom
      });
      assertSharesSumToTotal(newShares, total);
    } catch (e) {
      return badRequest((e as Error).message);
    }
    newTotal = total;
  }

  if (patch.payerId) {
    const inGroup = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: existing.groupId, userId: patch.payerId }
      }
    });
    if (!inGroup) return badRequest("payer not in group");
  }

  const expense = await prisma.$transaction(async (tx) => {
    if (newShares) {
      await tx.expenseShare.deleteMany({ where: { expenseId: existing.id } });
      await tx.expenseShare.createMany({
        data: newShares.map((s) => ({
          expenseId: existing.id,
          userId: s.userId,
          sharePaise: s.sharePaise
        }))
      });
    }
    return tx.expense.update({
      where: { id: existing.id },
      data: {
        payerId: patch.payerId,
        amountPaise: newTotal ?? undefined,
        description: patch.description,
        date: patch.date ? new Date(patch.date) : undefined,
        splitMode: patch.splitMode,
        source: patch.source,
        audioTranscript: patch.audioTranscript
      },
      include: { payer: true, shares: { include: { user: true } } }
    });
  });

  return ok({ expense });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const existing = await prisma.expense.findUnique({
    where: { id: params.id }
  });
  if (!existing) return notFound("expense");

  const mem = await requireMember(existing.groupId, user.id);
  if (mem.error) return mem.error;

  await prisma.expense.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
