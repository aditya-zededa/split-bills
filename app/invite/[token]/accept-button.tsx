"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/fetch";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAccept() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<{ groupId: string }>(
        "/api/invites/accept",
        { method: "POST", body: JSON.stringify({ token }) }
      );
      router.push(`/groups/${res.groupId}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={onAccept} disabled={busy} size="lg" className="w-full">
        {busy ? "Joining…" : "Accept & join"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
