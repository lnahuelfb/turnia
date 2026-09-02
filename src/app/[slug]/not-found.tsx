import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-neutral-50 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-neutral-400">
        Turnia
      </p>
      <h1 className="text-2xl font-bold text-neutral-900">
        No encontramos este comercio
      </h1>
      <p className="max-w-sm text-sm text-neutral-500">
        El link puede estar mal escrito o el comercio ya no está disponible.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
