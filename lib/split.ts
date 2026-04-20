// Share computation for an expense. All math in paise (BigInt).
// Invariant: sum(shares) === total.

export type SplitMode = "EQUAL" | "AMOUNT" | "PERCENT";

export type CustomShare = { userId: string; value: bigint };

export type SplitInput = {
  total: bigint;
  participants: string[]; // user ids, order matters for remainder assignment
  mode: SplitMode;
  custom?: CustomShare[]; // required for AMOUNT / PERCENT
};

export type SplitResult = Array<{ userId: string; sharePaise: bigint }>;

export function computeShares(input: SplitInput): SplitResult {
  const { total, participants, mode, custom } = input;

  if (total <= 0n) throw new Error("total must be positive");
  if (participants.length === 0) throw new Error("no participants");

  if (mode === "EQUAL") {
    return splitEqual(total, participants);
  }
  if (mode === "AMOUNT") {
    if (!custom) throw new Error("custom shares required for AMOUNT");
    return splitAmount(total, participants, custom);
  }
  if (mode === "PERCENT") {
    if (!custom) throw new Error("custom shares required for PERCENT");
    return splitPercent(total, participants, custom);
  }
  throw new Error(`unknown split mode: ${mode}`);
}

function splitEqual(total: bigint, participants: string[]): SplitResult {
  const n = BigInt(participants.length);
  const base = total / n;
  const remainder = total - base * n; // 0..n-1 paise
  return participants.map((userId, i) => ({
    userId,
    sharePaise: base + (BigInt(i) < remainder ? 1n : 0n)
  }));
}

function splitAmount(
  total: bigint,
  participants: string[],
  custom: CustomShare[]
): SplitResult {
  const byId = new Map(custom.map((c) => [c.userId, c.value]));
  for (const p of participants) {
    if (!byId.has(p)) throw new Error(`missing amount for user ${p}`);
    const v = byId.get(p)!;
    if (v < 0n) throw new Error("negative share");
  }
  const sum = participants.reduce((acc, p) => acc + byId.get(p)!, 0n);
  if (sum !== total) {
    throw new Error(`amount shares sum ${sum} != total ${total}`);
  }
  return participants.map((userId) => ({
    userId,
    sharePaise: byId.get(userId)!
  }));
}

// Percent values are basis points (100% = 10000). Sum must === 10000.
// Paise share = total * bps / 10000, last participant absorbs remainder.
function splitPercent(
  total: bigint,
  participants: string[],
  custom: CustomShare[]
): SplitResult {
  const byId = new Map(custom.map((c) => [c.userId, c.value]));
  for (const p of participants) {
    if (!byId.has(p)) throw new Error(`missing percent for user ${p}`);
    const v = byId.get(p)!;
    if (v < 0n) throw new Error("negative percent");
  }
  const bpsSum = participants.reduce((acc, p) => acc + byId.get(p)!, 0n);
  if (bpsSum !== 10000n) {
    throw new Error(`percent shares sum ${bpsSum} bps != 10000`);
  }

  const shares = participants.map((userId) => {
    const bps = byId.get(userId)!;
    return { userId, sharePaise: (total * bps) / 10000n };
  });

  // Remainder assignment: whatever is left goes to last participant.
  const sum = shares.reduce((a, s) => a + s.sharePaise, 0n);
  const diff = total - sum;
  if (diff !== 0n) {
    shares[shares.length - 1].sharePaise += diff;
  }
  return shares;
}

export function assertSharesSumToTotal(shares: SplitResult, total: bigint) {
  const sum = shares.reduce((a, s) => a + s.sharePaise, 0n);
  if (sum !== total) {
    throw new Error(`invariant violated: shares sum ${sum} != total ${total}`);
  }
}
