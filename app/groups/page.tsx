import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SignOutButton } from "./signout-button";
import { CreateGroupCard } from "./create-group-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function GroupsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      _count: { select: { expenses: true, members: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <main className="container py-6 sm:py-10 max-w-3xl px-4">
      <header className="flex items-center justify-between gap-3 pb-6 border-b">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Groups</h1>
          <p className="text-sm text-muted-foreground truncate">
            {session.user.email}
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="py-6 space-y-6">
        <CreateGroupCard />

        {groups.length === 0 ? (
          <div className="border rounded-lg bg-muted/40 py-10 text-center space-y-2">
            <p className="text-3xl">👥</p>
            <p className="text-sm font-medium">No groups yet</p>
            <p className="text-xs text-muted-foreground">Create one above to split your first expense.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.id}>
                <Link href={`/groups/${g.id}`}>
                  <Card className="hover:bg-accent transition-colors">
                    <CardHeader className="py-4">
                      <CardTitle className="text-lg">{g.name}</CardTitle>
                      <CardDescription>
                        {g._count.members} member{g._count.members === 1 ? "" : "s"} ·{" "}
                        {g._count.expenses} expense{g._count.expenses === 1 ? "" : "s"}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
