import { redirect } from "next/navigation";
import { getMyBusiness, requireUser } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Crear comercio", robots: { index: false } };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await getMyBusiness(user.id)) redirect("/app");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-neutral-900">Creá tu comercio</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Datos básicos para arrancar. Después configurás servicios, horarios y
          profesionales.
        </p>
        <div className="mt-6">
          <OnboardingForm />
        </div>
        <form action="/auth/signout" method="post" className="mt-6 text-center">
          <button type="submit" className="text-xs text-neutral-400 underline">
            Salir de {user.email}
          </button>
        </form>
      </div>
    </div>
  );
}
