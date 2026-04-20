"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type ToastKind = "default" | "success" | "error";
type Toast = { id: number; kind: ToastKind; title?: string; description?: string };

type ToastCtx = {
  push: (t: Omit<Toast, "id">) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

let _push: ToastCtx["push"] | null = null;

export function toast(t: Omit<Toast, "id">) {
  _push?.(t);
}
toast.success = (title: string, description?: string) =>
  _push?.({ kind: "success", title, description });
toast.error = (title: string, description?: string) =>
  _push?.({ kind: "error", title, description });
toast.info = (title: string, description?: string) =>
  _push?.({ kind: "default", title, description });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(1);

  const push = useCallback<ToastCtx["push"]>((t) => {
    const id = seq.current++;
    setItems((xs) => [...xs, { id, ...t }]);
    setTimeout(() => {
      setItems((xs) => xs.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    _push = push;
    return () => {
      _push = null;
    };
  }, [push]);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              "pointer-events-auto w-full max-w-sm rounded-md border bg-background px-4 py-3 text-sm shadow-lg " +
              (t.kind === "error"
                ? "border-destructive/50 text-destructive"
                : t.kind === "success"
                  ? "border-green-600/40 text-green-800"
                  : "")
            }
          >
            {t.title && <p className="font-medium">{t.title}</p>}
            {t.description && <p className="text-muted-foreground">{t.description}</p>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside <ToastProvider>");
  return ctx;
}
