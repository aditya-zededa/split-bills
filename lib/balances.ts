// Net balance per user + greedy debt simplification.
// All math in paise (BigInt).

export type ExpenseInput = {
  payerId: string;
  amountPaise: bigint;
  shares: Array<{ userId: string; sharePaise: bigint }>;
};

export type SettlementInput = {
  fromId: string;
  toId: string;
  amountPaise: bigint;
};

export type NetBalance = { userId: string; netPaise: bigint };
// net > 0 ⇒ user owes the group. net < 0 ⇒ group owes user.

export function computeNetBalances(
  memberIds: string[],
  expenses: ExpenseInput[],
  settlements: SettlementInput[]
): NetBalance[] {
  const net = new Map<string, bigint>();
  for (const id of memberIds) net.set(id, 0n);

  const add = (id: string, delta: bigint) => {
    if (!net.has(id)) net.set(id, 0n);
    net.set(id, net.get(id)! + delta);
  };

  for (const e of expenses) {
    // payer paid the full amount → they are owed it
    add(e.payerId, -e.amountPaise);
    // each share means that user owes their share
    for (const s of e.shares) {
      add(s.userId, s.sharePaise);
    }
  }

  for (const s of settlements) {
    // from paid to → from owes less (negative addition), to is owed less
    add(s.fromId, -s.amountPaise);
    add(s.toId, s.amountPaise);
  }

  return memberIds.map((id) => ({ userId: id, netPaise: net.get(id) ?? 0n }));
}

export type Transfer = { fromId: string; toId: string; amountPaise: bigint };

// Greedy who-pays-whom simplification.
// Positive net = debtor (owes group). Negative net = creditor (owed by group).
// Match largest creditor with largest debtor repeatedly.
export function simplifyDebts(balances: NetBalance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.netPaise > 0n)
    .map((b) => ({ ...b }))
    .sort((a, b) => (b.netPaise > a.netPaise ? 1 : -1));
  const creditors = balances
    .filter((b) => b.netPaise < 0n)
    .map((b) => ({ userId: b.userId, netPaise: -b.netPaise }))
    .sort((a, b) => (b.netPaise > a.netPaise ? 1 : -1));

  const transfers: Transfer[] = [];

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = d.netPaise < c.netPaise ? d.netPaise : c.netPaise;

    if (pay > 0n) {
      transfers.push({ fromId: d.userId, toId: c.userId, amountPaise: pay });
    }

    d.netPaise -= pay;
    c.netPaise -= pay;

    if (d.netPaise === 0n) i++;
    if (c.netPaise === 0n) j++;
  }

  return transfers;
}
