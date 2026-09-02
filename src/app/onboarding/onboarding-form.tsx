"use client";

import { useActionState, useState } from "react";
import { slugify } from "@/lib/slug";
import { createBusiness, type OnboardingState } from "./actions";

const initial: OnboardingState = {};

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createBusiness, initial);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const effectiveSlug = slugEdited ? slugify(slug) : slugify(name);

  return (
    <form action={action} className="space-y-4">
      <Field label="Nombre del comercio" error={state.field === "name" ? state.error : undefined}>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input"
          placeholder="Peluquería Juan"
        />
      </Field>

      <Field
        label="Link público"
        error={state.field === "slug" ? state.error : undefined}
        hint={effectiveSlug ? `turnia.app/${effectiveSlug}` : "turnia.app/tu-comercio"}
      >
        <input
          name="slug"
          value={slugEdited ? slug : effectiveSlug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEdited(true);
          }}
          className="input"
          placeholder="peluqueria-juan"
        />
      </Field>

      <Field label="Rubro (opcional)">
        <input name="category" className="input" placeholder="Peluquería, Manicura, Consultorio…" />
      </Field>

      <Field
        label="WhatsApp del comercio"
        error={state.field === "whatsapp" ? state.error : undefined}
        hint="Acá te llegan los avisos de turnos. Es único por cuenta."
      >
        <input name="whatsapp" type="tel" required className="input" placeholder="11 2345 6789" />
      </Field>

      {state.error && !state.field && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Creando…" : "Crear comercio"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-neutral-400">{hint}</span>
      ) : null}
    </label>
  );
}
