import { DateTime } from "luxon";
import { getMyBusiness, requireUser } from "@/lib/auth";
import { formatArs } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { CopyLinkButton } from "./copy-link-button";

export const metadata = { title: "Turnos" };

export default async function DashboardPage() {
  const user = await requireUser();
  const business = (await getMyBusiness(user.id))!;

  const now = new Date();
  const upcoming = await prisma.booking.findMany({
    where: { businessId: business.id, status: "CONFIRMED", startAt: { gte: now } },
    orderBy: { startAt: "asc" },
    take: 20,
    select: {
      id: true,
      startAt: true,
      clientName: true,
      serviceName: true,
      priceArs: true,
      professional: { select: { name: true } },
    },
  });

  const isTrial =
    !business.subscription || business.subscription.status === "TRIALING";
  const freeLeft = Math.max(
    0,
    business.freeBookingsQuota - business.freeBookingsUsed,
  );

  const grouped = groupByLocalDay(upcoming, business.timezone);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-sm font-medium text-neutral-900">Tu link de reservas</p>
        <p className="mt-0.5 text-sm text-neutral-500">
          Compartilo en tu bio de Instagram, WhatsApp, etc.
        </p>
        <div className="mt-3">
          <CopyLinkButton slug={business.slug} />
        </div>
      </section>

      {isTrial && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-neutral-900">Turnos gratis</span>
            <span className="text-neutral-500">
              {business.freeBookingsUsed} / {business.freeBookingsQuota} usados
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-indigo-600"
              style={{
                width: `${Math.min(100, (business.freeBookingsUsed / business.freeBookingsQuota) * 100)}%`,
              }}
            />
          </div>
          {freeLeft <= 10 && (
            <p className="mt-2 text-xs text-amber-700">
              Te quedan {freeLeft} turnos gratis. Después vas a tener que vincular
              Mercado Pago para seguir.
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">
          Próximos turnos
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-400">
            Todavía no hay turnos reservados.
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ dayLabel, items }) => (
              <div key={dayLabel}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  {dayLabel}
                </p>
                <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  {items.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-12 shrink-0 text-sm font-semibold text-neutral-900">
                        {DateTime.fromJSDate(b.startAt, {
                          zone: business.timezone,
                        }).toFormat("HH:mm")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {b.clientName}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {b.serviceName} · {b.professional.name}
                        </p>
                      </div>
                      {formatArs(b.priceArs?.toString() ?? null) && (
                        <span className="shrink-0 text-xs text-neutral-400">
                          {formatArs(b.priceArs?.toString() ?? null)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function groupByLocalDay<T extends { startAt: Date }>(bookings: T[], timezone: string) {
  const today = DateTime.now().setZone(timezone);
  const map = new Map<string, T[]>();
  for (const b of bookings) {
    const dt = DateTime.fromJSDate(b.startAt, { zone: timezone });
    const label = dt.hasSame(today, "day")
      ? "Hoy"
      : dt.toFormat("cccc d 'de' LLLL", { locale: "es" });
    const bucket = map.get(label) ?? [];
    bucket.push(b);
    map.set(label, bucket);
  }
  return [...map.entries()].map(([dayLabel, items]) => ({ dayLabel, items }));
}
