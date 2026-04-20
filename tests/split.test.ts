import { describe, expect, it } from "vitest";
import {
  computeShares,
  assertSharesSumToTotal,
  type SplitInput
} from "@/lib/split";

const ids = ["a", "b", "c"];

describe("computeShares — EQUAL", () => {
  it("splits evenly when divisible", () => {
    const r = computeShares({
      total: 30000n,
      participants: ids,
      mode: "EQUAL"
    });
    expect(r.map((x) => x.sharePaise)).toEqual([10000n, 10000n, 10000n]);
    assertSharesSumToTotal(r, 30000n);
  });

  it("distributes indivisible remainder to early participants", () => {
    // ₹100 / 3 = 3333.33 → 3334, 3333, 3333 in paise (10000 / 3)
    const r = computeShares({
      total: 10000n,
      participants: ids,
      mode: "EQUAL"
    });
    const sum = r.reduce((a, s) => a + s.sharePaise, 0n);
    expect(sum).toBe(10000n);
    expect(r[0].sharePaise).toBe(3334n);
    expect(r[1].sharePaise).toBe(3333n);
    expect(r[2].sharePaise).toBe(3333n);
  });

  it("single participant gets the full total", () => {
    const r = computeShares({
      total: 12345n,
      participants: ["only"],
      mode: "EQUAL"
    });
    expect(r).toEqual([{ userId: "only", sharePaise: 12345n }]);
  });

  it("throws on empty participants", () => {
    expect(() =>
      computeShares({ total: 100n, participants: [], mode: "EQUAL" })
    ).toThrow(/no participants/);
  });

  it("throws on non-positive total", () => {
    expect(() =>
      computeShares({ total: 0n, participants: ids, mode: "EQUAL" })
    ).toThrow(/positive/);
  });
});

describe("computeShares — AMOUNT", () => {
  it("accepts exact amount split", () => {
    const input: SplitInput = {
      total: 10000n,
      participants: ids,
      mode: "AMOUNT",
      custom: [
        { userId: "a", value: 5000n },
        { userId: "b", value: 3000n },
        { userId: "c", value: 2000n }
      ]
    };
    const r = computeShares(input);
    expect(r.map((x) => x.sharePaise)).toEqual([5000n, 3000n, 2000n]);
  });

  it("rejects sum mismatch", () => {
    expect(() =>
      computeShares({
        total: 10000n,
        participants: ids,
        mode: "AMOUNT",
        custom: [
          { userId: "a", value: 5000n },
          { userId: "b", value: 3000n },
          { userId: "c", value: 1000n }
        ]
      })
    ).toThrow(/sum/);
  });

  it("rejects missing participant value", () => {
    expect(() =>
      computeShares({
        total: 10000n,
        participants: ids,
        mode: "AMOUNT",
        custom: [
          { userId: "a", value: 5000n },
          { userId: "b", value: 5000n }
        ]
      })
    ).toThrow(/missing amount/);
  });

  it("rejects negative share", () => {
    expect(() =>
      computeShares({
        total: 10000n,
        participants: ["a", "b"],
        mode: "AMOUNT",
        custom: [
          { userId: "a", value: 11000n },
          { userId: "b", value: -1000n }
        ]
      })
    ).toThrow(/negative/);
  });
});

describe("computeShares — PERCENT", () => {
  it("splits by basis points summing to 10000", () => {
    const r = computeShares({
      total: 10000n,
      participants: ids,
      mode: "PERCENT",
      custom: [
        { userId: "a", value: 5000n }, // 50%
        { userId: "b", value: 3000n }, // 30%
        { userId: "c", value: 2000n } // 20%
      ]
    });
    expect(r.map((x) => x.sharePaise)).toEqual([5000n, 3000n, 2000n]);
  });

  it("assigns remainder to last participant", () => {
    // ₹100 at 33.33%, 33.33%, 33.34% → last absorbs rounding
    const r = computeShares({
      total: 10000n,
      participants: ids,
      mode: "PERCENT",
      custom: [
        { userId: "a", value: 3333n },
        { userId: "b", value: 3333n },
        { userId: "c", value: 3334n }
      ]
    });
    const sum = r.reduce((a, s) => a + s.sharePaise, 0n);
    expect(sum).toBe(10000n);
  });

  it("rejects bps sum != 10000", () => {
    expect(() =>
      computeShares({
        total: 10000n,
        participants: ids,
        mode: "PERCENT",
        custom: [
          { userId: "a", value: 5000n },
          { userId: "b", value: 3000n },
          { userId: "c", value: 1000n }
        ]
      })
    ).toThrow(/10000/);
  });
});
