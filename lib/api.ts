// Shared helpers for API route handlers.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializePaise } from "@/lib/money";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      user: null,
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 })
    };
  }
  return { user: session.user as { id: string; email?: string | null; name?: string | null }, error: null };
}

export async function requireMember(groupId: string, userId: string) {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } }
  });
  if (!m) {
    return {
      member: null,
      error: NextResponse.json({ error: "not a group member" }, { status: 403 })
    };
  }
  return { member: m, error: null };
}

export async function requireOwner(groupId: string, userId: string) {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } }
  });
  if (!m || m.role !== "OWNER") {
    return {
      member: null,
      error: NextResponse.json({ error: "owner only" }, { status: 403 })
    };
  }
  return { member: m, error: null };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(serializePaise(data), init);
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}
