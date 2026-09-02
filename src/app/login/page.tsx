import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Ingresar", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;

  if (await getUser()) redirect(next ?? "/app");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-indigo-600">
          Turnia
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold text-neutral-900">
          Panel del comercio
        </h1>
        <p className="mt-1 text-center text-sm text-neutral-500">
          Ingresá para administrar tus turnos.
        </p>

        {error === "auth" && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
            No pudimos validar el link. Probá de nuevo.
          </p>
        )}

        <div className="mt-6">
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
