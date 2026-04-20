import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializePaise } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExpensesTab, type ExpenseRow } from "./tabs/expenses-tab";
import { BalancesTab } from "./tabs/balances-tab";
import { ActivityTab } from "./tabs/activity-tab";
import { MembersTab } from "./tabs/members-tab";
import { SettingsTab } from "./tabs/settings-tab";

export default async function GroupDetailPage({
  params
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const mem = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: session.user.id } }
  });
  if (!mem) notFound();

  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: {
      members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
      expenses: {
        orderBy: { date: "desc" },
        take: 50,
        include: { payer: true, shares: { include: { user: true } } }
      },
      settlements: {
        orderBy: { date: "desc" },
        include: { from: true, to: true }
      },
      invites: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  if (!group) notFound();

  const serialized = serializePaise(group) as unknown as typeof group;
  const isOwner = mem.role === "OWNER";

  return (
    <main className="container py-6 sm:py-8 max-w-3xl px-4">
      <nav className="pb-4 text-sm">
        <Link href="/groups" className="text-muted-foreground hover:underline">
          ← Groups
        </Link>
      </nav>

      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b">
        <div>
          <h1 className="text-2xl font-semibold break-words">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {group.members.length} member{group.members.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href={`/groups/${group.id}/add`}>+ Add expense</Link>
        </Button>
      </header>

      <Tabs defaultValue="expenses" className="pt-6">
        <TabsList className="w-full grid grid-cols-5 h-auto">
          <TabsTrigger value="expenses" className="text-xs sm:text-sm">Expenses</TabsTrigger>
          <TabsTrigger value="balances" className="text-xs sm:text-sm">Balances</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
          <TabsTrigger value="members" className="text-xs sm:text-sm">Members</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <ExpensesTab
            groupId={group.id}
            expenses={serialized.expenses as unknown as ExpenseRow[]}
          />
        </TabsContent>

        <TabsContent value="balances">
          <BalancesTab
            groupId={group.id}
            members={group.members.map((m) => ({
              id: m.user.id,
              name: m.user.name,
              email: m.user.email
            }))}
            currentUserId={session.user.id}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab groupId={group.id} />
        </TabsContent>

        <TabsContent value="members">
          <MembersTab
            groupId={group.id}
            members={serialized.members}
            invites={serialized.invites}
            currentUserId={session.user.id}
            isOwner={isOwner}
          />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab group={serialized} isOwner={isOwner} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

