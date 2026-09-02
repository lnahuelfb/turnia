"use client";

import { useState } from "react";

type State = "idle" | "confirming" | "submitting" | "done" | "error";

export function CancelButton({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");

  async function cancel() {
    setState("submitting");
    try {
      const res = await fetch(`/api/turnos/${token}/cancelar`, { method: "POST" });
      if (!res.ok && res.status !== 409) throw new Error(String(res.status));
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-700">
        Listo, tu turno quedó cancelado.
      </p>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm text-red-600">No se pudo cancelar. Probá de nuevo.</p>
        <button
          type="button"
          onClick={cancel}
          className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (state === "confirming") {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm text-neutral-600">
          ¿Seguro que querés cancelar este turno?
        </p>
        <button
          type="button"
          onClick={cancel}
          className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white"
        >
          Sí, cancelar turno
        </button>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="w-full rounded-lg py-2 text-sm font-medium text-neutral-500"
        >
          No, mantener el turno
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState("confirming")}
      disabled={state === "submitting"}
      className="w-full rounded-lg border border-red-200 bg-white py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50"
    >
      {state === "submitting" ? "Cancelando…" : "Cancelar turno"}
    </button>
  );
}
