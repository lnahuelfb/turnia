import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { CancelButton } from "./cancel-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cancelar turno", robots: { index: false } };

type Params = { params: Promise<{ token: string }> };

export default async function CancelPage({ params }: Params) {
  const { token } = await params;

  const booking = await prisma.booking.findUnique({
    where: { cancelToken: token },
    select: {
      status: true,
      startAt: true,
      serviceName: true,
      clientName: true,
      professional: { select: { name: true } },
      business: { select: { name: true, timezone: true } },
    },
  });
  if (!booking) notFound();

  const when = DateTime.fromJSDate(booking.startAt, {
    zone: booking.business.timezone,
  }).toFormat("cccc d 'de' LLLL, HH:mm 'h'", { locale: "es" });

  const alreadyCancelled =
    booking.status === "CANCELLED_BY_CLIENT" ||
    booking.status === "CANCELLED_BY_BUSINESS";
  const past =
    booking.startAt.getTime() <= Date.now() ||
    booking.status === "COMPLETED" ||
    booking.status === "NO_SHOW";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-6 py-12 text-neutral-900">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5">
        <h1 className="text-lg font-bold">{booking.business.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">Turno de {booking.clientName}</p>

        <dl className="mt-4 space-y-1 text-sm">
          <Row label="Servicio" value={booking.serviceName} />
          <Row label="Profesional" value={booking.professional.name} />
          <Row label="Cuándo" value={when} />
        </dl>

        <div className="mt-5">
          {alreadyCancelled ? (
            <p className="rounded-lg bg-neutral-100 px-3 py-2 text-center text-sm text-neutral-600">
              Este turno ya está cancelado.
            </p>
          ) : past ? (
            <p className="rounded-lg bg-neutral-100 px-3 py-2 text-center text-sm text-neutral-600">
              Este turno ya pasó y no se puede cancelar.
            </p>
          ) : (
            <CancelButton token={token} />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-400">{label}</dt>
      <dd className="text-right font-medium text-neutral-800">{value}</dd>
    </div>
  );
}
