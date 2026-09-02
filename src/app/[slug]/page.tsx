import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { getPublicBusinessPage } from "@/lib/business/public-page";
import type { PublicBusinessPage } from "@/lib/business/types";
import { prisma } from "@/lib/prisma";
import { BookingFlow } from "./booking-flow";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusinessPage(prisma, slug);
  if (!business) return { title: "Comercio no encontrado" };

  const description = business.bio ?? `Reservá tu turno en ${business.name} online.`;
  const image = business.coverUrl ?? business.logoUrl ?? undefined;

  return {
    title: business.name,
    description,
    openGraph: {
      title: business.name,
      description,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: business.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PublicBusinessPage({ params }: Params) {
  const { slug } = await params;
  const business = await getPublicBusinessPage(prisma, slug);
  if (!business) notFound();

  const onVacation =
    business.vacationUntil !== null && new Date(business.vacationUntil) > new Date();
  const vacationLabel = business.vacationUntil
    ? DateTime.fromISO(business.vacationUntil, { zone: business.timezone }).toFormat(
        "d 'de' LLLL",
        { locale: "es" },
      )
    : null;

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-xl">
        <Header business={business} />

        <div className="px-4 pb-16">
          {onVacation ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              El comercio está en modo vacaciones hasta el <strong>{vacationLabel}</strong>.
              No se pueden reservar turnos por ahora.
            </div>
          ) : business.services.length === 0 ? (
            <p className="mt-8 text-center text-sm text-neutral-500">
              Este comercio todavía no cargó sus servicios.
            </p>
          ) : (
            <BookingFlow business={business} />
          )}
        </div>

        <footer className="border-t border-neutral-200 px-4 py-6 text-center text-xs text-neutral-400">
          Reservas con <span className="font-semibold text-neutral-500">Turnia</span>
        </footer>
      </div>
    </div>
  );
}

function Header({
  business,
}: {
  business: PublicBusinessPage;
}) {
  const initials = business.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header>
      <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-600 sm:h-36 sm:rounded-b-2xl">
        {business.coverUrl && (
          <Image
            src={business.coverUrl}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="576px"
          />
        )}
      </div>

      <div className="px-4">
        <div className="relative z-10 -mt-8 mb-2">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-neutral-50 bg-indigo-100 text-lg font-bold leading-none text-indigo-700 shadow-sm">
            {business.logoUrl ? (
              <Image
                src={business.logoUrl}
                alt={business.name}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
        </div>

        <h1 className="text-xl font-bold">{business.name}</h1>
        {business.category && (
          <p className="text-sm text-neutral-500">{business.category}</p>
        )}
        {business.bio && (
          <p className="mt-2 text-sm text-neutral-600">{business.bio}</p>
        )}
        {business.addressText && (
          <p className="mt-2 text-sm text-neutral-500">📍 {business.addressText}</p>
        )}

        <SocialLinks business={business} />
      </div>
    </header>
  );
}

function SocialLinks({
  business,
}: {
  business: PublicBusinessPage;
}) {
  const links: { href: string; label: string }[] = [];
  if (business.instagramUrl) links.push({ href: business.instagramUrl, label: "Instagram" });
  if (business.facebookUrl) links.push({ href: business.facebookUrl, label: "Facebook" });
  if (business.websiteUrl) links.push({ href: business.websiteUrl, label: "Sitio web" });
  if (links.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-300"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}
