"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/fetch";
import { toast } from "@/components/ui/toast";

type UserLite = { id: string; name: string | null; email: string };

type Member = {
  id: string;
  userId: string;
  role: "OWNER" | "MEMBER";
  user: UserLite;
};

type Invite = {
  id: string;
  email: string;
  token: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
};

export function MembersTab({
  groupId,
  members,
  invites,
  currentUserId,
  isOwner
}: {
  groupId: string;
  members: Member[];
  invites: Invite[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setLastLink(null);
    try {
      const res = await apiJson<{ acceptUrl: string }>(
        `/api/groups/${groupId}/invites`,
        { method: "POST", body: JSON.stringify({ email: email.trim() }) }
      );
      setEmail("");
      setLastLink(res.acceptUrl);
      toast.success("Invite created", "Copy the link and send it.");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Invite failed", msg);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(uid: string) {
    if (!confirm("Remove this member?")) return;
    try {
      await apiJson(`/api/groups/${groupId}/members/${uid}`, {
        method: "DELETE"
      });
      toast.success(uid === currentUserId ? "Left group" : "Member removed");
      router.refresh();
    } catch (err) {
      toast.error("Action failed", (err as Error).message);
    }
  }

  return (
    <div className="space-y-6 py-2">
      <section>
        <h2 className="font-semibold mb-2">Members</h2>
        <ul className="space-y-1 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between border-b py-1.5">
              <span>
                {m.user.name ?? m.user.email}
                {m.role === "OWNER" && <span className="ml-2 text-xs text-muted-foreground">owner</span>}
                {m.userId === currentUserId && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
              </span>
              {(m.userId === currentUserId || isOwner) && m.role !== "OWNER" && (
                <Button variant="ghost" size="sm" onClick={() => removeMember(m.userId)}>
                  {m.userId === currentUserId ? "Leave" : "Remove"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Invite by email</h2>
        <form onSubmit={invite} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="invite-email" className="sr-only">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "…" : "Invite"}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        {lastLink && (
          <div className="mt-3 p-3 bg-muted rounded-md text-sm break-all">
            <p className="font-medium mb-1">Invite link (copy & send):</p>
            <code className="text-xs">{lastLink}</code>
          </div>
        )}
      </section>

      {invites.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Pending invites</h2>
          <ul className="space-y-1 text-sm">
            {invites.map((i) => {
              const base = typeof window !== "undefined" ? window.location.origin : "";
              const link = `${base}/invite/${i.token}`;
              return (
                <li key={i.id} className="flex justify-between border-b py-1.5">
                  <span>{i.email}</span>
                  <button
                    type="button"
                    className="text-xs text-primary underline underline-offset-2"
                    onClick={() => {
                      navigator.clipboard?.writeText(link);
                      toast.success("Invite link copied");
                    }}
                  >
                    Copy link
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
