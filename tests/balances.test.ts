import { describe, expect, it } from "vitest";
import { computeNetBalances, simplifyDebts } from "@/lib/balances";

describe("computeNetBalances", () => {
  it("empty group → all zero", () => {
    const r = computeNetBalances(["a", "b"], [], []);
    expect(r).toEqual([
      { userId: "a", netPaise: 0n },
      { userId: "b", netPaise: 0n }
    ]);
  });

  it("equal expense: payer owed by other shares", () => {
    // a paid 30000, split equally between a/b/c → each owes 10000
    const r = computeNetBalances(
      ["a", "b", "c"],
      [
        {
          payerId: "a",
          amountPaise: 30000n,
          shares: [
            { userId: "a", sharePaise: 10000n },
            { userId: "b", sharePaise: 10000n },
            { userId: "c", sharePaise: 10000n }
          ]
        }
      ],
      []
    );
    expect(r.find((x) => x.userId === "a")!.netPaise).toBe(-20000n);
    expect(r.find((x) => x.userId === "b")!.netPaise).toBe(10000n);
    expect(r.find((x) => x.userId === "c")!.netPaise).toBe(10000n);
  });

  it("settlement reduces debt", () => {
    const r = computeNetBalances(
      ["a", "b"],
      [
        {
          payerId: "a",
          amountPaise: 20000n,
          shares: [
            { userId: "a", sharePaise: 10000n },
            { userId: "b", sharePaise: 10000n }
          ]
        }
      ],
      [{ fromId: "b", toId: "a", amountPaise: 10000n }]
    );
    // a is net 0, b is net 0
    expect(r.find((x) => x.userId === "a")!.netPaise).toBe(0n);
    expect(r.find((x) => x.userId === "b")!.netPaise).toBe(0n);
  });

  it("sum of all nets is zero", () => {
    const r = computeNetBalances(
      ["a", "b", "c"],
      [
        {
          payerId: "b",
          amountPaise: 9000n,
          shares: [
            { userId: "a", sharePaise: 3000n },
            { userId: "b", sharePaise: 3000n },
            { userId: "c", sharePaise: 3000n }
          ]
        }
      ],
      [{ fromId: "c", toId: "b", amountPaise: 1000n }]
    );
    const total = r.reduce((a, x) => a + x.netPaise, 0n);
    expect(total).toBe(0n);
  });
});

describe("simplifyDebts", () => {
  it("no transfers when all zero", () => {
    expect(
      simplifyDebts([
        { userId: "a", netPaise: 0n },
        { userId: "b", netPaise: 0n }
      ])
    ).toEqual([]);
  });

  it("one debtor, one creditor", () => {
    const t = simplifyDebts([
      { userId: "a", netPaise: -10000n },
      { userId: "b", netPaise: 10000n }
    ]);
    expect(t).toEqual([
      { fromId: "b", toId: "a", amountPaise: 10000n }
    ]);
  });

  it("matches largest debtor with largest creditor", () => {
    // c owes 30, b owes 10. a is owed 30, d is owed 10.
    // Expected: c→a 30, b→d 10
    const t = simplifyDebts([
      { userId: "a", netPaise: -30000n },
      { userId: "b", netPaise: 10000n },
      { userId: "c", netPaise: 30000n },
      { userId: "d", netPaise: -10000n }
    ]);
    expect(t).toContainEqual({
      fromId: "c",
      toId: "a",
      amountPaise: 30000n
    });
    expect(t).toContainEqual({
      fromId: "b",
      toId: "d",
      amountPaise: 10000n
    });
    expect(t).toHaveLength(2);
  });

  it("chain settles net transfers, not per-edge", () => {
    // a owes 100, b owes 50, c owed 150 → 2 transfers, not 3
    const t = simplifyDebts([
      { userId: "a", netPaise: 10000n },
      { userId: "b", netPaise: 5000n },
      { userId: "c", netPaise: -15000n }
    ]);
    expect(t).toHaveLength(2);
    const sum = t.reduce((s, x) => s + x.amountPaise, 0n);
    expect(sum).toBe(15000n);
  });

  it("sum of transfers matches total debt", () => {
    const t = simplifyDebts([
      { userId: "a", netPaise: 12345n },
      { userId: "b", netPaise: 6789n },
      { userId: "c", netPaise: -19134n }
    ]);
    const sum = t.reduce((s, x) => s + x.amountPaise, 0n);
    expect(sum).toBe(19134n);
  });
});
