import "server-only";
import { type BookingStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import { computeAvailableSlots } from "@/lib/availability/availability";
import { assembleAvailabilityInput } from "@/lib/availability/from-db";
import { normalizeArPhone } from "@/lib/phone";
import { BookingError } from "./errors";

const ACTIVE_STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED", "NO_SHOW"];

export interface CreateBookingInput {
  slug: string;
  serviceId: string;
  /** `null` / omitido = "cualquiera disponible". */
  professionalId?: string | null;
  /** Instante de inicio pedido (UTC). */
  startAt: Date;
  client: { name: string; phone: string; email?: string | null };
  now?: Date;
}

export interface CreateBookingResult {
  bookingId: string;
  cancelToken: string;
  professional: { id: string; name: string };
  service: { name: string; durationMin: number; priceArs: string | null };
  startAt: string;
  endAt: string;
  business: { name: string; slug: string; whatsappPhone: string; timezone: string };
  /** Turnos gratis que le quedan al comercio, o `null` si ya es pago. */
  freeBookingsRemaining: number | null;
}

export async function createBooking(
  prisma: PrismaClient,
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const now = input.now ?? new Date();
  const name = input.client.name.trim();
  if (name.length < 2) throw new BookingError("INVALID_INPUT", "Nombre inválido");

  let phone: string;
  try {
    phone = normalizeArPhone(input.client.phone);
  } catch {
    throw new BookingError("INVALID_INPUT", "WhatsApp inválido");
  }

  const email = input.client.email?.trim() || null;

  if (input.startAt.getTime() <= now.getTime()) {
    throw new BookingError("IN_THE_PAST");
  }

  try {
    return await prisma.$transaction((tx) =>
      runBooking(tx, { ...input, name, phone, email, now }),
    );
  } catch (err) {
    if (isExclusionViolation(err)) throw new BookingError("SLOT_TAKEN");
    throw err;
  }
}

async function runBooking(
  tx: Prisma.TransactionClient,
  input: CreateBookingInput & { name: string; phone: string; email: string | null; now: Date },
): Promise<CreateBookingResult> {
  const { now } = input;

  const business = await tx.business.findUnique({
    where: { slug: input.slug },
    select: {
      id: true,
      name: true,
      slug: true,
      whatsappPhone: true,
      timezone: true,
      slotGranularityMin: true,
      vacationUntil: true,
      freeBookingsQuota: true,
      freeBookingsUsed: true,
      businessHours: { select: { weekday: true, startMinute: true, endMinute: true } },
      holidays: { select: { date: true, works: true } },
      subscription: { select: { status: true, graceUntil: true } },
    },
  });
  if (!business) throw new BookingError("BUSINESS_NOT_FOUND");

  assertCanAcceptBooking(business, now);

  const service = await tx.service.findFirst({
    where: { id: input.serviceId, businessId: business.id, active: true },
    select: {
      id: true,
      name: true,
      durationMin: true,
      bufferBeforeMin: true,
      bufferAfterMin: true,
      priceArs: true,
      professionals: {
        where: { professional: { active: true } },
        select: {
          professionalId: true,
          professional: {
            select: {
              name: true,
              sortOrder: true,
              workingHours: {
                select: { weekday: true, startMinute: true, endMinute: true },
              },
            },
          },
        },
      },
    },
  });
  if (!service) throw new BookingError("SERVICE_NOT_FOUND");

  let candidates = service.professionals;
  if (input.professionalId) {
    candidates = candidates.filter((p) => p.professionalId === input.professionalId);
  }
  if (candidates.length === 0) throw new BookingError("PROFESSIONAL_NOT_FOUND");

  const startAt = input.startAt;
  const endAt = new Date(startAt.getTime() + service.durationMin * 60_000);

  // Cliente bloqueado por ausencias.
  const existingClient = await tx.client.findUnique({
    where: { businessId_phone: { businessId: business.id, phone: input.phone } },
    select: { id: true, blockedUntil: true },
  });
  if (
    existingClient?.blockedUntil &&
    existingClient.blockedUntil.getTime() > now.getTime()
  ) {
    throw new BookingError("CLIENT_BLOCKED");
  }

  const candidateIds = candidates.map((c) => c.professionalId);
  const dayStart = DateTime.fromJSDate(startAt, { zone: business.timezone }).startOf("day");
  const dayEnd = dayStart.plus({ days: 1 });
  const winFrom = dayStart.toJSDate();
  const winTo = dayEnd.toJSDate();

  const [dayBookings, timeOff] = await Promise.all([
    tx.booking.findMany({
      where: {
        professionalId: { in: candidateIds },
        status: { in: ACTIVE_STATUSES },
        startAt: { lt: winTo },
        endAt: { gt: winFrom },
      },
      select: { professionalId: true, startAt: true, endAt: true },
    }),
    tx.timeOff.findMany({
      where: {
        businessId: business.id,
        OR: [{ professionalId: null }, { professionalId: { in: candidateIds } }],
        startAt: { lt: winTo },
        endAt: { gt: winFrom },
      },
      select: { professionalId: true, startAt: true, endAt: true },
    }),
  ]);

  // Profesionales para los que el slot pedido está libre.
  const free = candidates.filter((c) =>
    slotIsAvailable({
      startAtMs: startAt.getTime(),
      business,
      service,
      professional: c.professional,
      dayBookings: dayBookings.filter((b) => b.professionalId === c.professionalId),
      timeOff: timeOff.filter(
        (t) => t.professionalId === null || t.professionalId === c.professionalId,
      ),
      winFrom,
      winTo,
      now,
    }),
  );
  if (free.length === 0) throw new BookingError("SLOT_UNAVAILABLE");

  // Asignación "cualquiera": menos cargado ese día, desempata sortOrder.
  const chosen = [...free].sort((a, b) => {
    const load = (id: string) => dayBookings.filter((x) => x.professionalId === id).length;
    return (
      load(a.professionalId) - load(b.professionalId) ||
      a.professional.sortOrder - b.professional.sortOrder
    );
  })[0];

  const client = existingClient
    ? await tx.client.update({
        where: { id: existingClient.id },
        data: { name: input.name, ...(input.email ? { email: input.email } : {}) },
        select: { id: true },
      })
    : await tx.client.create({
        data: {
          businessId: business.id,
          phone: input.phone,
          name: input.name,
          email: input.email,
        },
        select: { id: true },
      });

  const booking = await tx.booking.create({
    data: {
      businessId: business.id,
      professionalId: chosen.professionalId,
      serviceId: service.id,
      clientId: client.id,
      startAt,
      endAt,
      status: "CONFIRMED",
      source: "PUBLIC",
      serviceName: service.name,
      clientName: input.name,
      priceArs: service.priceArs,
    },
    select: { id: true, cancelToken: true },
  });

  let freeBookingsRemaining: number | null = null;
  if (!business.subscription || business.subscription.status === "TRIALING") {
    const updated = await tx.business.update({
      where: { id: business.id },
      data: { freeBookingsUsed: { increment: 1 } },
      select: { freeBookingsUsed: true, freeBookingsQuota: true },
    });
    freeBookingsRemaining = Math.max(0, updated.freeBookingsQuota - updated.freeBookingsUsed);
  }

  return {
    bookingId: booking.id,
    cancelToken: booking.cancelToken,
    professional: { id: chosen.professionalId, name: chosen.professional.name },
    service: {
      name: service.name,
      durationMin: service.durationMin,
      priceArs: service.priceArs?.toString() ?? null,
    },
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    business: {
      name: business.name,
      slug: business.slug,
      whatsappPhone: business.whatsappPhone,
      timezone: business.timezone,
    },
    freeBookingsRemaining,
  };
}

type BusinessGate = {
  freeBookingsQuota: number;
  freeBookingsUsed: number;
  subscription: { status: string; graceUntil: Date | null } | null;
};

function assertCanAcceptBooking(business: BusinessGate, now: Date) {
  const sub = business.subscription;
  if (!sub || sub.status === "TRIALING") {
    if (business.freeBookingsUsed >= business.freeBookingsQuota) {
      throw new BookingError("QUOTA_EXCEEDED");
    }
    return;
  }
  if (sub.status === "ACTIVE") return;
  if (sub.status === "PAST_DUE" && sub.graceUntil && sub.graceUntil.getTime() > now.getTime()) {
    return;
  }
  throw new BookingError("SUBSCRIPTION_INACTIVE");
}

function slotIsAvailable(args: {
  startAtMs: number;
  business: {
    timezone: string;
    slotGranularityMin: number;
    vacationUntil: Date | null;
    businessHours: { weekday: number; startMinute: number; endMinute: number }[];
    holidays: { date: Date; works: boolean }[];
  };
  service: { durationMin: number; bufferBeforeMin: number; bufferAfterMin: number };
  professional: {
    workingHours: { weekday: number; startMinute: number; endMinute: number }[];
  };
  dayBookings: { startAt: Date; endAt: Date }[];
  timeOff: { startAt: Date; endAt: Date }[];
  winFrom: Date;
  winTo: Date;
  now: Date;
}): boolean {
  const input = assembleAvailabilityInput({
    business: {
      timezone: args.business.timezone,
      slotGranularityMin: args.business.slotGranularityMin,
      vacationUntil: args.business.vacationUntil,
      businessHours: args.business.businessHours,
    },
    professional: {
      workingHours: args.professional.workingHours,
      bookings: args.dayBookings.map((b) => ({ start: b.startAt, end: b.endAt })),
      timeOff: args.timeOff.map((t) => ({ start: t.startAt, end: t.endAt })),
    },
    service: args.service,
    from: args.winFrom,
    to: args.winTo,
    holidays: args.business.holidays,
    notBefore: args.now,
  });

  return computeAvailableSlots(input).some((d) => d.getTime() === args.startAtMs);
}

function isExclusionViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("booking_no_overlap") ||
    msg.includes("23p01") ||
    msg.includes("exclusion constraint")
  );
}
