"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [googleLoading, setGoogleLoading] = useState(false);

  const redirectTo = () => {
    const url = new URL("/auth/callback", window.location.origin);
    if (next) url.searchParams.set("next", next);
    return url.toString();
  };

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    setState(error ? "error" : "sent");
  }

  async function google() {
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setGoogleLoading(false);
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center text-sm">
        <p className="font-medium text-neutral-900">Revisá tu email</p>
        <p className="mt-1 text-neutral-500">
          Te mandamos un link a <span className="font-medium">{email}</span> para
          entrar. Podés cerrar esta pestaña.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={google}
        disabled={googleLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white py-2.5 text-sm font-semibold text-neutral-700 hover:border-neutral-400 disabled:opacity-50"
      >
        {googleLoading ? "Redirigiendo…" : "Continuar con Google"}
      </button>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />o<span className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={sendMagicLink} className="space-y-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="tu@email.com"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {state === "sending" ? "Enviando…" : "Enviarme un link para entrar"}
        </button>
        {state === "error" && (
          <p className="text-center text-xs text-red-600">
            No se pudo enviar. Revisá el email y probá de nuevo.
          </p>
        )}
      </form>
    </div>
  );
}
