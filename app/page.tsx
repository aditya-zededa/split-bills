import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/groups");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Split</h1>
        <p className="text-muted-foreground text-lg">
          WhatsApp-to-split. Paste or speak an expense. Done.
        </p>

        <div className="flex flex-col gap-3 pt-4">
          <Button asChild size="lg">
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">Create account</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/groups">Browse groups →</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-8">
          INR only · Email + password · Local-only
        </p>
      </div>
    </main>
  );
}
