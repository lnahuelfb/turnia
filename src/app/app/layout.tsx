import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyBusiness, requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/onboarding");

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{business.name}</p>
            <a
              href={`/${business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline"
            >
              turnia.app/{business.slug}
            </a>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-xs text-neutral-400 hover:text-neutral-600">
              Salir
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2">
          <NavLink href="/app">Turnos</NavLink>
          <NavLink href="/app/servicios">Servicios</NavLink>
          <NavLink href="/app/agenda">Horarios</NavLink>
          <NavLink href="/app/config">Configuración</NavLink>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-900"
    >
      {children}
    </Link>
  );
}
