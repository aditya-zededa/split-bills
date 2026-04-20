"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/fetch";
import { toast } from "@/components/ui/toast";

type Group = { id: string; name: string };

export function SettingsTab({
  group,
  isOwner
}: {
  group: Group;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (name === group.name) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/api/groups/${group.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() })
      });
      toast.success("Group renamed");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Rename failed", msg);
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/api/groups/${group.id}`, { method: "DELETE" });
      toast.success("Group deleted");
      router.push("/groups");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Delete failed", msg);
      setBusy(false);
    }
  }

  if (!isOwner) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Only the group owner can edit settings.
      </p>
    );
  }

  return (
    <div className="space-y-6 py-2">
      <form onSubmit={rename} className="space-y-3 max-w-md">
        <Label htmlFor="g-name">Group name</Label>
        <div className="flex gap-2">
          <Input
            id="g-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            disabled={busy}
          />
          <Button type="submit" disabled={busy || name === group.name}>
            Save
          </Button>
        </div>
      </form>

      <div className="pt-6 border-t space-y-2">
        <h2 className="font-semibold text-destructive">Danger zone</h2>
        <Button variant="destructive" onClick={del} disabled={busy}>
          Delete group
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
