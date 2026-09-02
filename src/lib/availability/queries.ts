import "server-only";
import { type BookingStatus, type PrismaClient } from "@prisma/client";
import { computeAvailableSlots } from "./availability";
import { assembleAvailabilityInput } from "./from-db";

/**
 * Capa de datos del motor de disponibilidad: arma el input desde Prisma y
 * corre el cálculo por cada profesional que ofrece el servicio.
 */

/** Turnos en estos estados ocupan la agenda. */
const ACTIVE_STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED", "NO_SHOW"];

export class AvailabilityNotFoundError extends Error {
  constructor(public readonly resource: "business" | "service") {
    super(`No encontrado: ${resource}`);
    this.name = "AvailabilityNotFoundError";
  }
}

export interface PublicAvailabilityQuery {
  slug: string;
  serviceId: string;
  /** Si se omite, se calcula para todos los profesionales que hacen el servicio. */
  professionalId?: string | null;
  from: Date;
  to: Date;
  /** No ofrecer turnos antes de este instante (default: ahora). */
  notBefore?: Date;
}

export interface AvailabilitySlot {
  /** Instante de inicio, ISO 8601 UTC. */
  start: string;
  /** Profesionales libres en ese horario (para "cualquiera disponible"). */
  professionalIds: string[];
}

export interface PublicAvailabilityResult {
  business: { id: string; name: string; timezone: string };
  service: {
    id: string;
    name: string;
    durationMin: number;
    priceArs: string | null;
    showPrice: boolean;
  };
  professionals: { id: string; name: string }[];
  slots: AvailabilitySlot[];
}

export async function getPublicAvailability(
  prisma: PrismaClient,
  q: PublicAvailabilityQuery,
): Promise<PublicAvailabilityResult> {
  const business = await prisma.business.findUnique({
    where: { slug: q.slug },
    select: {
      id: true,
      name: true,
      timezone: true,
      slotGranularityMin: true,
      vacationUntil: true,
      businessHours: {
        select: { weekday: true, startMinute: true, endMinute: true },
      },
    },
  });
  if (!business) throw new AvailabilityNotFoundError("business");

  const service = await prisma.service.findFirst({
    where: { id: q.serviceId, businessId: business.id, active: true },
    select: {
      id: true,
      name: true,
      durationMin: true,
      bufferBeforeMin: true,
      bufferAfterMin: true,
      priceArs: true,
      showPrice: true,
      professionals: {
        where: {
          professional: { active: true },
          ...(q.professionalId ? { professionalId: q.professionalId } : {}),
        },
        select: { professionalId: true, professional: { select: { name: true } } },
      },
    },
  });
  if (!service) throw new AvailabilityNotFoundError("service");

  const serviceOut = {
    id: service.id,
    name: service.name,
    durationMin: service.durationMin,
    priceArs: service.priceArs?.toString() ?? null,
    showPrice: service.showPrice,
  };
  const businessOut = {
    id: business.id,
    name: business.name,
    timezone: business.timezone,
  };

  const pros = service.professionals.map((p) => ({
    id: p.professionalId,
    name: p.professional.name,
  }));
  if (pros.length === 0) {
    return { business: businessOut, service: serviceOut, professionals: [], slots: [] };
  }

  const professionalIds = pros.map((p) => p.id);

  const [profHours, bookings, timeOff, holidays] = await Promise.all([
    prisma.professionalHour.findMany({
      where: { professionalId: { in: professionalIds } },
      select: { professionalId: true, weekday: true, startMinute: true, endMinute: true },
    }),
    prisma.booking.findMany({
      where: {
        professionalId: { in: professionalIds },
        status: { in: ACTIVE_STATUSES },
        startAt: { lt: q.to },
        endAt: { gt: q.from },
      },
      select: { professionalId: true, startAt: true, endAt: true },
    }),
    prisma.timeOff.findMany({
      where: {
        businessId: business.id,
        OR: [{ professionalId: null }, { professionalId: { in: professionalIds } }],
        startAt: { lt: q.to },
        endAt: { gt: q.from },
      },
      select: { professionalId: true, startAt: true, endAt: true },
    }),
    prisma.holiday.findMany({
      where: { businessId: business.id },
      select: { date: true, works: true },
    }),
  ]);

  const service_ = {
    durationMin: service.durationMin,
    bufferBeforeMin: service.bufferBeforeMin,
    bufferAfterMin: service.bufferAfterMin,
  };

  const slotMap = new Map<number, Set<string>>();

  for (const pro of pros) {
    const input = assembleAvailabilityInput({
      business,
      professional: {
        workingHours: profHours
          .filter((h) => h.professionalId === pro.id)
          .map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute })),
        bookings: bookings
          .filter((b) => b.professionalId === pro.id)
          .map(({ startAt, endAt }) => ({ start: startAt, end: endAt })),
        timeOff: timeOff
          .filter((t) => t.professionalId === null || t.professionalId === pro.id)
          .map(({ startAt, endAt }) => ({ start: startAt, end: endAt })),
      },
      service: service_,
      from: q.from,
      to: q.to,
      holidays,
      notBefore: q.notBefore,
    });

    for (const slot of computeAvailableSlots(input)) {
      const ms = slot.getTime();
      let set = slotMap.get(ms);
      if (!set) {
        set = new Set();
        slotMap.set(ms, set);
      }
      set.add(pro.id);
    }
  }

  const slots: AvailabilitySlot[] = [...slotMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ms, ids]) => ({
      start: new Date(ms).toISOString(),
      professionalIds: [...ids],
    }));

  return { business: businessOut, service: serviceOut, professionals: pros, slots };
}
