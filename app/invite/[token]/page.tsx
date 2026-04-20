import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInviteButton } from "./accept-button";

export default async function InviteAcceptPage({
  params
}: {
  params: { token: string };
}) {
  const session = await getServerSession(authOptions);

  const invite = await prisma.invite.findUnique({
    where: { token: params.token },
    include: { group: true }
  });

  if (!invite) {
    return (
      <main className="container py-16 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Invite not found</CardTitle>
            <CardDescription>The link may be invalid or expired.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const status = invite.status;

  return (
    <main className="container py-16 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Join &ldquo;{invite.group.name}&rdquo;</CardTitle>
          <CardDescription>
            You were invited to join this group as {invite.email}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status !== "PENDING" && (
            <p className="text-sm text-muted-foreground">
              This invite is {status.toLowerCase()}.
            </p>
          )}

          {status === "PENDING" && !session?.user && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in or create an account with {invite.email} to accept. The email must match the invite.
              </p>
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link
                    href={`/signin?callbackUrl=${encodeURIComponent(`/invite/${params.token}`)}`}
                  >
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/signup">Sign up</Link>
                </Button>
              </div>
            </div>
          )}

          {status === "PENDING" && session?.user && (
            <>
              {session.user.email?.toLowerCase() !== invite.email.toLowerCase() ? (
                <p className="text-sm text-destructive">
                  Signed in as {session.user.email}, but invite is for {invite.email}. Sign out and try again.
                </p>
              ) : (
                <AcceptInviteButton token={params.token} />
              )}
            </>
          )}

          <div className="pt-2">
            <Link href="/groups" className="text-xs text-muted-foreground hover:underline">
              Go to my groups →
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
