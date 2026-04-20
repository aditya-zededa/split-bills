import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, requireMember, requireUser } from "@/lib/api";

type Actor = { id: string; name: string | null; email: string };

type ActivityItem =
  | {
      kind: "expense.created";
      at: string;
      id: string;
      actor: Actor;
      expenseId: string;
      description: string;
      amountPaise: string;
      source: "MANUAL" | "AUDIO";
    }
  | {
      kind: "settlement";
      at: string;
      id: string;
      from: Actor;
      to: Actor;
      amountPaise: string;
      note: string | null;
    }
  | {
      kind: "member.joined";
      at: string;
      id: string;
      actor: Actor;
    }
  | {
      kind: "invite.created";
      at: string;
      id: string;
      actor: Actor;
      email: string;
      status: "PENDING" | "ACCEPTED" | "REVOKED";
    };

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { member, error: mErr } = await requireMember(params.id, user!.id);
  if (mErr) return mErr;
  void member;

  const [expenses, settlements, members, invites] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId: params.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { payer: true }
    }),
    prisma.settlement.findMany({
      where: { groupId: params.id },
      orderBy: { date: "desc" },
      take: 100,
      include: { from: true, to: true }
    }),
    prisma.groupMember.findMany({
      where: { groupId: params.id },
      orderBy: { joinedAt: "desc" },
      take: 100,
      include: { user: true }
    }),
    prisma.invite.findMany({
      where: { groupId: params.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { inviter: true }
    })
  ]);

  const actorOf = (u: { id: string; name: string | null; email: string }): Actor => ({
    id: u.id,
    name: u.name,
    email: u.email
  });

  const items: ActivityItem[] = [];

  for (const e of expenses) {
    items.push({
      kind: "expense.created",
      at: e.createdAt.toISOString(),
      id: `e-${e.id}`,
      actor: actorOf(e.payer),
      expenseId: e.id,
      description: e.description,
      amountPaise: e.amountPaise.toString(),
      source: e.source
    });
  }

  for (const s of settlements) {
    items.push({
      kind: "settlement",
      at: s.date.toISOString(),
      id: `s-${s.id}`,
      from: actorOf(s.from),
      to: actorOf(s.to),
      amountPaise: s.amountPaise.toString(),
      note: s.note ?? null
    });
  }

  for (const m of members) {
    items.push({
      kind: "member.joined",
      at: m.joinedAt.toISOString(),
      id: `m-${m.id}`,
      actor: actorOf(m.user)
    });
  }

  for (const i of invites) {
    items.push({
      kind: "invite.created",
      at: i.createdAt.toISOString(),
      id: `i-${i.id}`,
      actor: actorOf(i.inviter),
      email: i.email,
      status: i.status
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));

  return ok({ activity: items.slice(0, 100) });
}
