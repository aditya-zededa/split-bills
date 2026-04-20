"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiJson } from "@/lib/fetch";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { computeShares } from "@/lib/split";
import { toast } from "@/components/ui/toast";

type Member = { id: string; name: string | null; email: string };

type SplitMode = "EQUAL" | "AMOUNT" | "PERCENT";

export function ExpenseForm({
  groupId,
  members,
  currentUserId,
  initial,
  audioTranscript,
  createMode
}: {
  groupId: string;
  members: Member[];
  currentUserId: string;
  initial?: {
    id: string;
    description: string;
    amountPaise: string;
    date: string;
    payerId: string;
    splitMode: SplitMode;
    shares: Array<{ userId: string; sharePaise: string }>;
  };
  audioTranscript?: string;
  /** When true, submit POSTs a new expense even if `initial` was provided (used for audio prefill). */
  createMode?: boolean;
}) {
  const router = useRouter();

  const [description, setDescription] = useState(initial?.description ?? "");
  const [amountStr, setAmountStr] = useState(
    initial ? (Number(initial.amountPaise) / 100).toString() : ""
  );
  const [date, setDate] = useState(
    initial ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [payerId, setPayerId] = useState(initial?.payerId ?? currentUserId);
  const [splitMode, setSplitMode] = useState<SplitMode>(initial?.splitMode ?? "EQUAL");

  const initialParticipants = initial
    ? new Set(initial.shares.map((s) => s.userId))
    : new Set(members.map((m) => m.id));
  const [participants, setParticipants] = useState<Set<string>>(initialParticipants);

  // For AMOUNT mode: per-user rupee string input
  const [amountShares, setAmountShares] = useState<Record<string, string>>(() => {
    if (initial && initial.splitMode === "AMOUNT") {
      return Object.fromEntries(
        initial.shares.map((s) => [s.userId, (Number(s.sharePaise) / 100).toString()])
      );
    }
    return {};
  });

  // For PERCENT mode: per-user percent string (0-100)
  const [percentShares, setPercentShares] = useState<Record<string, string>>(() => {
    if (initial && initial.splitMode === "PERCENT") {
      const total = BigInt(initial.amountPaise);
      return Object.fromEntries(
        initial.shares.map((s) => {
          const bps = total > 0n ? (BigInt(s.sharePaise) * 10000n) / total : 0n;
          return [s.userId, (Number(bps) / 100).toString()];
        })
      );
    }
    return {};
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPaise = useMemo(() => {
    try {
      const n = Number(amountStr);
      if (!amountStr || !Number.isFinite(n) || n <= 0) return null;
      return rupeesToPaise(n);
    } catch {
      return null;
    }
  }, [amountStr]);

  const participantList = members.filter((m) => participants.has(m.id));

  // Live preview of shares
  const preview = useMemo(() => {
    if (!totalPaise || participantList.length === 0) return null;
    try {
      if (splitMode === "EQUAL") {
        return computeShares({
          total: totalPaise,
          participants: participantList.map((p) => p.id),
          mode: "EQUAL"
        });
      }
      if (splitMode === "AMOUNT") {
        const custom = participantList.map((p) => ({
          userId: p.id,
          value: rupeesToPaise(Number(amountShares[p.id] ?? 0))
        }));
        return computeShares({
          total: totalPaise,
          participants: participantList.map((p) => p.id),
          mode: "AMOUNT",
          custom
        });
      }
      // PERCENT — convert to basis points
      const custom = participantList.map((p) => ({
        userId: p.id,
        value: BigInt(Math.round(Number(percentShares[p.id] ?? 0) * 100))
      }));
      return computeShares({
        total: totalPaise,
        participants: participantList.map((p) => p.id),
        mode: "PERCENT",
        custom
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [totalPaise, participantList, splitMode, amountShares, percentShares]);

  function toggleParticipant(id: string) {
    const next = new Set(participants);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setParticipants(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!description.trim()) return setError("description required");
    if (!totalPaise) return setError("amount required");
    if (participantList.length === 0) return setError("pick at least one participant");

    const payload: Record<string, unknown> = {
      payerId,
      amountPaise: totalPaise.toString(),
      description: description.trim(),
      date: new Date(date).toISOString(),
      splitMode,
      participants: participantList.map((p) => p.id),
      source: audioTranscript ? "AUDIO" : "MANUAL",
      ...(audioTranscript ? { audioTranscript } : {})
    };

    if (splitMode === "AMOUNT") {
      payload.customShares = participantList.map((p) => ({
        userId: p.id,
        value: rupeesToPaise(Number(amountShares[p.id] ?? 0)).toString()
      }));
    } else if (splitMode === "PERCENT") {
      payload.customShares = participantList.map((p) => ({
        userId: p.id,
        value: Math.round(Number(percentShares[p.id] ?? 0) * 100)
      }));
    }

    setBusy(true);
    try {
      const isUpdate = initial && !createMode;
      if (isUpdate) {
        await apiJson(`/api/expenses/${initial!.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        toast.success("Expense updated");
      } else {
        await apiJson(`/api/groups/${groupId}/expenses`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        toast.success("Expense added");
      }
      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Save failed", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="desc">Description</Label>
        <Input
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dinner at Toit"
          maxLength={200}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount (₹)</Label>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="1200"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Paid by</Label>
        <Select value={payerId} onValueChange={setPayerId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name ?? m.email}
                {m.id === currentUserId && " (you)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Split mode</Label>
        <RadioGroup
          value={splitMode}
          onValueChange={(v) => setSplitMode(v as SplitMode)}
          className="flex gap-4"
        >
          {(["EQUAL", "AMOUNT", "PERCENT"] as SplitMode[]).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value={m} />
              {m === "EQUAL" ? "Equal" : m === "AMOUNT" ? "By amount" : "By percent"}
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Participants</Label>
        <ul className="space-y-2 border rounded-md p-3">
          {members.map((m) => {
            const checked = participants.has(m.id);
            return (
              <li key={m.id} className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleParticipant(m.id)}
                  />
                  <span>{m.name ?? m.email}</span>
                </label>
                {checked && splitMode === "AMOUNT" && (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28"
                    placeholder="₹"
                    value={amountShares[m.id] ?? ""}
                    onChange={(e) =>
                      setAmountShares({ ...amountShares, [m.id]: e.target.value })
                    }
                  />
                )}
                {checked && splitMode === "PERCENT" && (
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-24"
                    placeholder="%"
                    value={percentShares[m.id] ?? ""}
                    onChange={(e) =>
                      setPercentShares({ ...percentShares, [m.id]: e.target.value })
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border rounded-md p-3 bg-muted/40 text-sm space-y-1">
        <p className="font-medium">Preview</p>
        {preview && "error" in preview ? (
          <p className="text-destructive">{preview.error}</p>
        ) : preview ? (
          <ul className="space-y-0.5">
            {preview.map((s) => {
              const m = members.find((x) => x.id === s.userId)!;
              return (
                <li key={s.userId} className="flex justify-between">
                  <span>{m.name ?? m.email}</span>
                  <span>{formatINR(s.sharePaise)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground">Enter amount and participants.</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy
            ? "Saving…"
            : initial && !createMode
              ? "Save changes"
              : "Add expense"}
        </Button>
      </div>
    </form>
  );
}
