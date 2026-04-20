"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiJson } from "@/lib/fetch";
import { toast } from "@/components/ui/toast";

export function CreateGroupCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await apiJson<{ group: { id: string } }>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() })
      });
      setName("");
      toast.success("Group created");
      router.push(`/groups/${res.group.id}`);
      router.refresh();
    } catch (err) {
      toast.error("Couldn’t create group", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">New group</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="group-name" className="sr-only">Name</Label>
            <Input
              id="group-name"
              placeholder="Goa trip, Apt 402, Sunday brunch…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              required
              maxLength={80}
            />
          </div>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "…" : "Create"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
