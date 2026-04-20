"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/fetch";
import { toast } from "@/components/ui/toast";

export function DeleteExpenseButton({
  expenseId,
  groupId
}: {
  expenseId: string;
  groupId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("Delete this expense?")) return;
    setBusy(true);
    try {
      await apiJson(`/api/expenses/${expenseId}`, { method: "DELETE" });
      toast.success("Expense deleted");
      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (e) {
      toast.error("Delete failed", (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={del} disabled={busy}>
      Delete
    </Button>
  );
}
