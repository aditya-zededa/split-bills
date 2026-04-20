"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiJson } from "@/lib/fetch";
import { formatINR } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";

type Actor = { id: string; name: string | null; email: string };

type Item =
  | {
      kind: "expense.created";
      at: string;
      id: string;
      actor: Actor;
      expenseId: string;
      description: string;
      amountPaise: string;
      source: "MANUAL" | "AUDIO";
    }
  | {
      kind: "settlement";
      at: string;
      id: string;
      from: Actor;
      to: Actor;
      amountPaise: string;
      note: string | null;
    }
  | { kind: "member.joined"; at: string; id: string; actor: Actor }
  | {
      kind: "invite.created";
      at: string;
      id: string;
      actor: Actor;
      email: string;
      status: "PENDING" | "ACCEPTED" | "REVOKED";
    };

function nameOf(u: Actor) {
  return u.name ?? u.email;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.round(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function ActivityTab({ groupId }: { groupId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiJson<{ activity: Item[] }>(`/api/groups/${groupId}/activity`)
      .then((d) => alive && setItems(d.activity))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [groupId]);

  if (error) return <p className="text-sm text-destructive py-4">{error}</p>;

  if (!items) {
    return (
      <div className="space-y-2 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center space-y-2 border rounded-lg bg-muted/40">
        <p className="text-3xl">📭</p>
        <p className="text-sm font-medium">No activity yet</p>
        <p className="text-xs text-muted-foreground">
          Expenses, payments, invites and new members will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y border rounded-lg py-1">
      {items.map((it) => (
        <li key={it.id} className="px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-lg leading-none mt-0.5">
              {it.kind === "expense.created"
                ? it.source === "AUDIO"
                  ? "🎙️"
                  : "🧾"
                : it.kind === "settlement"
                  ? "💸"
                  : it.kind === "member.joined"
                    ? "👤"
                    : "✉️"}
            </span>
            <div className="min-w-0">
              {it.kind === "expense.created" && (
                <p className="text-sm">
                  <span className="font-medium">{nameOf(it.actor)}</span> added{" "}
                  <Link
                    href={`/groups/${groupId}/expense/${it.expenseId}`}
                    className="underline underline-offset-2"
                  >
                    {it.description}
                  </Link>{" "}
                  for <span className="font-medium">{formatINR(BigInt(it.amountPaise))}</span>
                </p>
              )}
              {it.kind === "settlement" && (
                <p className="text-sm">
                  <span className="font-medium">{nameOf(it.from)}</span> paid{" "}
                  <span className="font-medium">{nameOf(it.to)}</span>{" "}
                  <span className="font-medium">{formatINR(BigInt(it.amountPaise))}</span>
                  {it.note && <span className="text-muted-foreground"> · {it.note}</span>}
                </p>
              )}
              {it.kind === "member.joined" && (
                <p className="text-sm">
                  <span className="font-medium">{nameOf(it.actor)}</span> joined the group
                </p>
              )}
              {it.kind === "invite.created" && (
                <p className="text-sm">
                  <span className="font-medium">{nameOf(it.actor)}</span> invited{" "}
                  <span className="font-medium">{it.email}</span>
                  {it.status !== "PENDING" && (
                    <span className="text-muted-foreground"> · {it.status.toLowerCase()}</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
            {timeAgo(it.at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
