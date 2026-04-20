import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  notFound,
  ok,
  requireMember,
  requireUser
} from "@/lib/api";
import { computeNetBalances, simplifyDebts } from "@/lib/balances";

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
      members: { include: { user: true } }
    }
  });
  if (!group) return notFound("group");

  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId: params.id },
      include: { shares: true }
    }),
    prisma.settlement.findMany({ where: { groupId: params.id } })
  ]);

  const memberIds = group.members.map((m) => m.userId);

  const nets = computeNetBalances(
    memberIds,
    expenses.map((e) => ({
      payerId: e.payerId,
      amountPaise: e.amountPaise,
      shares: e.shares.map((s) => ({
        userId: s.userId,
        sharePaise: s.sharePaise
      }))
    })),
    settlements.map((s) => ({
      fromId: s.fromId,
      toId: s.toId,
      amountPaise: s.amountPaise
    }))
  );

  const transfers = simplifyDebts(nets);

  const userById = new Map(group.members.map((m) => [m.userId, m.user]));

  return ok({
    balances: nets.map((n) => ({
      user: userById.get(n.userId),
      netPaise: n.netPaise
    })),
    transfers: transfers.map((t) => ({
      from: userById.get(t.fromId),
      to: userById.get(t.toId),
      amountPaise: t.amountPaise
    }))
  });
}
