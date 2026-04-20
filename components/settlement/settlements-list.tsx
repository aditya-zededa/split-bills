"use client";

import { formatINR } from "@/lib/money";

type UserLite = { id: string; name: string | null; email: string };

export type SettlementRow = {
  id: string;
  date: string;
  amountPaise: string;
  note: string | null;
  from: UserLite;
  to: UserLite;
};

export function SettlementsList({ settlements }: { settlements: SettlementRow[] }) {
  if (settlements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No payments recorded yet.
      </p>
    );
  }
  return (
    <ul className="space-y-1 text-sm">
      {settlements.map((s) => (
        <li key={s.id} className="flex justify-between border-b py-1.5">
          <span>
            {s.from.name ?? s.from.email} → {s.to.name ?? s.to.email}
            {s.note && <span className="text-muted-foreground"> · {s.note}</span>}
          </span>
          <span className="font-medium">{formatINR(BigInt(s.amountPaise))}</span>
        </li>
      ))}
    </ul>
  );
}
