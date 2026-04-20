"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { apiJson } from "@/lib/fetch";
import { paiseToRupees, rupeesToPaise } from "@/lib/money";
import { toast } from "@/components/ui/toast";

type Member = { id: string; name: string | null; email: string };

export function SettleUpDialog({
  groupId,
  members,
  currentUserId,
  prefill,
  trigger
}: {
  groupId: string;
  members: Member[];
  currentUserId: string;
  prefill?: { fromId: string; toId: string; amountPaise: string };
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState(prefill?.fromId ?? currentUserId);
  const [toId, setToId] = useState(
    prefill?.toId ?? members.find((m) => m.id !== currentUserId)?.id ?? ""
  );
  const [amountStr, setAmountStr] = useState(
    prefill ? paiseToRupees(BigInt(prefill.amountPaise)).toString() : ""
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && prefill) {
      setFromId(prefill.fromId);
      setToId(prefill.toId);
      setAmountStr(paiseToRupees(BigInt(prefill.amountPaise)).toString());
    }
  }, [open, prefill]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (fromId === toId) return setError("from and to must differ");
    const n = Number(amountStr);
    if (!Number.isFinite(n) || n <= 0) return setError("amount required");

    setBusy(true);
    try {
      await apiJson(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        body: JSON.stringify({
          fromId,
          toId,
          amountPaise: rupeesToPaise(n).toString(),
          note: note.trim() || undefined
        })
      });
      setOpen(false);
      setAmountStr("");
      setNote("");
      toast.success("Payment recorded");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Couldn’t record payment", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Updates balances. Does not send any money.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settle-amt">Amount (₹)</Label>
            <Input
              id="settle-amt"
              type="number"
              min="0"
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settle-note">Note (optional)</Label>
            <Input
              id="settle-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="UPI, cash, etc."
              maxLength={200}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Record payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
