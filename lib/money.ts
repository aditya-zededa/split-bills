// Money helpers. INR stored as BigInt paise.

export const RUPEE = "₹";

export function rupeesToPaise(rupees: number | string): bigint {
  const n = typeof rupees === "string" ? Number(rupees) : rupees;
  if (!Number.isFinite(n)) throw new Error("invalid amount");
  // Round to nearest paise to avoid 0.1 + 0.2 float mess.
  return BigInt(Math.round(n * 100));
}

export function paiseToRupees(paise: bigint | number): number {
  const p = typeof paise === "number" ? BigInt(paise) : paise;
  return Number(p) / 100;
}

export function formatINR(paise: bigint | number): string {
  const rupees = paiseToRupees(paise);
  return `${RUPEE}${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

// Serialize BigInt for JSON responses.
export function serializePaise<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}
