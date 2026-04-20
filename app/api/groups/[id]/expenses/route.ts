import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  ok,
  requireMember,
  requireUser
} from "@/lib/api";
import { createExpenseSchema, toBigInt } from "@/lib/validators";
import { computeShares, assertSharesSumToTotal } from "@/lib/split";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const mem = await requireMember(params.id, user.id);
  if (mem.error) return mem.error;

  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 200);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const expenses = await prisma.expense.findMany({
    where: { groupId: params.id },
    orderBy: { date: "desc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      payer: true,
      shares: { include: { user: true } }
    }
  });

  return ok({
    expenses,
    nextCursor: expenses.length === take ? expenses[expenses.length - 1].id : null
  });
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
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());

  const {
    payerId,
    amountPaise,
    description,
    date,
    splitMode,
    participants,
    customShares,
    source,
    audioTranscript
  } = parsed.data;

  // Validate: payer and participants must all be group members.
  const members = await prisma.groupMember.findMany({
    where: { groupId: params.id },
    select: { userId: true }
  });
  const memberIds = new Set(members.map((m) => m.userId));
  if (!memberIds.has(payerId)) return badRequest("payer not in group");
  for (const p of participants) {
    if (!memberIds.has(p)) return badRequest(`participant ${p} not in group`);
  }

  const total = toBigInt(amountPaise);

  const custom = customShares?.map((c) => ({
    userId: c.userId,
    value: toBigInt(c.value)
  }));

  let shares;
  try {
    shares = computeShares({
      total,
      participants,
      mode: splitMode,
      custom
    });
    assertSharesSumToTotal(shares, total);
  } catch (e) {
    return badRequest((e as Error).message);
  }

  const expense = await prisma.expense.create({
    data: {
      groupId: params.id,
      payerId,
      amountPaise: total,
      description,
      date: date ? new Date(date) : new Date(),
      splitMode,
      source,
      audioTranscript,
      shares: {
        create: shares.map((s) => ({
          userId: s.userId,
          sharePaise: s.sharePaise
        }))
      }
    },
    include: {
      payer: true,
      shares: { include: { user: true } }
    }
  });

  return ok({ expense }, { status: 201 });
}
