import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  badRequest,
  ok,
  requireMember,
  requireUser
} from "@/lib/api";
import { inviteSchema } from "@/lib/validators";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const mem = await requireMember(params.id, user.id);
  if (mem.error) return mem.error;

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());

  const email = parsed.data.email;

  // If a user with that email is already a member, short-circuit.
  const existingMember = await prisma.groupMember.findFirst({
    where: { groupId: params.id, user: { email } }
  });
  if (existingMember) {
    return badRequest("user already in group");
  }

  // Rate-limit: max 10 invites per user per day across all groups.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.invite.count({
    where: { invitedBy: user.id, createdAt: { gt: dayAgo } }
  });
  if (recentCount >= 10) {
    return badRequest("invite rate limit reached (10/day)");
  }

  const token = randomBytes(24).toString("base64url");

  const invite = await prisma.invite.create({
    data: {
      groupId: params.id,
      email,
      invitedBy: user.id,
      token,
      status: "PENDING"
    }
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const acceptUrl = `${base}/invite/${token}`;

  return ok({ invite, acceptUrl }, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const mem = await requireMember(params.id, user.id);
  if (mem.error) return mem.error;

  const invites = await prisma.invite.findMany({
    where: { groupId: params.id },
    orderBy: { createdAt: "desc" }
  });
  return ok({ invites });
}
