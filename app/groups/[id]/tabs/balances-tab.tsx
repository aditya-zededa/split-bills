"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/fetch";
import { formatINR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SettleUpDialog } from "@/components/settlement/settle-up-dialog";
import { SettlementsList, type SettlementRow } from "@/components/settlement/settlements-list";

type UserLite = { id: string; name: string | null; email: string };

type BalancesResponse = {
  balances: Array<{ user: UserLite; netPaise: string }>;
  transfers: Array<{ from: UserLite; to: UserLite; amountPaise: string }>;
};

type SettlementsResponse = { settlements: SettlementRow[] };

export function BalancesTab({
  groupId,
  members,
  currentUserId
}: {
  groupId: string;
  members: UserLite[];
  currentUserId: string;
}) {
  const [data, setData] = useState<BalancesResponse | null>(null);
  const [settlements, setSettlements] = useState<SettlementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiJson<BalancesResponse>(`/api/groups/${groupId}/balances`),
      apiJson<SettlementsResponse>(`/api/groups/${groupId}/settlements`)
    ])
      .then(([b, s]) => {
        if (!alive) return;
        setData(b);
        setSettlements(s.settlements);
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [groupId, tick]);

  if (error) return <p className="text-sm text-destructive py-4">{error}</p>;
  if (!data || !settlements) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }

  const nonZero = data.balances.filter((b) => BigInt(b.netPaise) !== 0n);

  return (
    <div className="space-y-6 py-2" onFocus={reload}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Net balances</h2>
        <SettleUpDialog
          groupId={groupId}
          members={members}
          currentUserId={currentUserId}
          trigger={<Button size="sm">Settle up</Button>}
        />
      </div>

      {nonZero.length === 0 ? (
        <div className="border rounded-md p-6 text-center space-y-1">
          <p className="text-2xl">🎉</p>
          <p className="text-sm font-medium">Everyone is settled up</p>
          <p className="text-xs text-muted-foreground">Add an expense to get going again.</p>
        </div>
      ) : (
        <ul className="space-y-1 text-sm">
          {nonZero.map((b) => {
            const net = BigInt(b.netPaise);
            const owes = net > 0n;
            const absPaise = owes ? net : -net;
            return (
              <li key={b.user.id} className="flex justify-between border-b py-1.5">
                <span>{b.user.name ?? b.user.email}</span>
                <span className={owes ? "text-destructive" : "text-green-700"}>
                  {owes ? "owes" : "gets back"} {formatINR(absPaise)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <section>
        <h2 className="font-semibold mb-2">Simplified transfers</h2>
        {data.transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to settle.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.transfers.map((t, i) => (
              <li key={i} className="flex justify-between items-center border-b py-1.5">
                <span>
                  {t.from.name ?? t.from.email} → {t.to.name ?? t.to.email}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatINR(BigInt(t.amountPaise))}</span>
                  <SettleUpDialog
                    groupId={groupId}
                    members={members}
                    currentUserId={currentUserId}
                    prefill={{
                      fromId: t.from.id,
                      toId: t.to.id,
                      amountPaise: t.amountPaise
                    }}
                    trigger={
                      <Button variant="outline" size="sm">
                        Settle
                      </Button>
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Payments</h2>
        <SettlementsList settlements={settlements} />
      </section>
    </div>
  );
}
