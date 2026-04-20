"use client";

import Link from "next/link";
import { formatINR } from "@/lib/money";

export type ExpenseRow = {
  id: string;
  description: string;
  date: string;
  amountPaise: string;
  splitMode: "EQUAL" | "AMOUNT" | "PERCENT";
  source: "MANUAL" | "AUDIO";
  payer: { id: string; name: string | null; email: string };
  shares: Array<{ userId: string; sharePaise: string; user: { id: string; name: string | null; email: string } }>;
};

export function ExpensesTab({
  groupId,
  expenses
}: {
  groupId: string;
  expenses: ExpenseRow[];
}) {
  if (expenses.length === 0) {
    return (
      <div className="py-12 text-center space-y-3 border rounded-lg bg-muted/40">
        <p className="text-3xl">🧾</p>
        <p className="text-sm font-medium">No expenses yet</p>
        <Link
          href={`/groups/${groupId}/add`}
          className="inline-block text-primary underline underline-offset-2 text-sm"
        >
          Add the first one →
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y border rounded-lg">
      {expenses.map((e) => (
        <li key={e.id}>
          <Link
            href={`/groups/${groupId}/expense/${e.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-accent transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{e.description}</p>
              <p className="text-xs text-muted-foreground">
                {e.payer.name ?? e.payer.email} ·{" "}
                {new Date(e.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })}
                {e.source === "AUDIO" && <> · 🎙️</>}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatINR(BigInt(e.amountPaise))}</p>
              <p className="text-xs text-muted-foreground">{e.splitMode.toLowerCase()}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
