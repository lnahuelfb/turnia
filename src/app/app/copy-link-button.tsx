"use client";

import { useState } from "react";

export function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/${slug}`
      : `turnia.app/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bloqueado: no pasa nada */
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 truncate rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white"
      >
        {copied ? "¡Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
