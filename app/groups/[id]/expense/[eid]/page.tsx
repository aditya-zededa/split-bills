import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializePaise } from "@/lib/money";
import { ExpenseForm } from "@/components/expense/expense-form";
import { DeleteExpenseButton } from "./delete-button";

export default async function EditExpensePage({
  params
}: {
  params: { id: string; eid: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const mem = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: session.user.id } }
  });
  if (!mem) notFound();

  const expense = await prisma.expense.findFirst({
    where: { id: params.eid, groupId: params.id },
    include: { shares: true }
  });
  if (!expense) notFound();

  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: {
      members: { include: { user: true }, orderBy: { joinedAt: "asc" } }
    }
  });
  if (!group) notFound();

  const members = group.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email
  }));

  const serialized = serializePaise({
    id: expense.id,
    description: expense.description,
    amountPaise: expense.amountPaise,
    date: expense.date.toISOString(),
    payerId: expense.payerId,
    splitMode: expense.splitMode,
    shares: expense.shares.map((s) => ({
      userId: s.userId,
      sharePaise: s.sharePaise
    }))
  }) as unknown as {
    id: string;
    description: string;
    amountPaise: string;
    date: string;
    payerId: string;
    splitMode: "EQUAL" | "AMOUNT" | "PERCENT";
    shares: Array<{ userId: string; sharePaise: string }>;
  };

  return (
    <main className="container py-8 max-w-xl">
      <nav className="pb-4 text-sm">
        <Link href={`/groups/${group.id}`} className="text-muted-foreground hover:underline">
          ← {group.name}
        </Link>
      </nav>

      <div className="flex items-center justify-between pb-6">
        <h1 className="text-2xl font-semibold">Edit expense</h1>
        <DeleteExpenseButton expenseId={expense.id} groupId={group.id} />
      </div>

      <ExpenseForm
        groupId={group.id}
        members={members}
        currentUserId={session.user.id}
        initial={serialized}
      />
    </main>
  );
}
