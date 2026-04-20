import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExpenseForm } from "@/components/expense/expense-form";
import { AudioTab } from "@/components/expense/audio-tab";

export default async function AddExpensePage({
  params
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: {
      members: { include: { user: true }, orderBy: { joinedAt: "asc" } }
    }
  });
  if (!group) notFound();
  if (!group.members.some((m) => m.userId === session.user.id)) notFound();

  const members = group.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email
  }));

  const audioEnabled = Boolean(process.env.OPENAI_API_KEY);

  return (
    <main className="container py-6 sm:py-8 max-w-xl px-4">
      <nav className="pb-4 text-sm">
        <Link href={`/groups/${group.id}`} className="text-muted-foreground hover:underline">
          ← {group.name}
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold pb-6">Add expense</h1>

      <Tabs defaultValue={audioEnabled ? "audio" : "type"}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="audio" disabled={!audioEnabled}>
            🎙️ Record
          </TabsTrigger>
          <TabsTrigger value="type">Type</TabsTrigger>
        </TabsList>

        <TabsContent value="audio">
          {audioEnabled ? (
            <AudioTab
              groupId={group.id}
              members={members}
              currentUserId={session.user.id}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-6">
              Set OPENAI_API_KEY to enable audio input.
            </p>
          )}
        </TabsContent>

        <TabsContent value="type">
          <ExpenseForm
            groupId={group.id}
            members={members}
            currentUserId={session.user.id}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}
