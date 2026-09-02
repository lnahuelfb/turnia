import { DateTime } from "luxon";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestBusiness,
  resetDb,
  testPrisma,
} from "@/test/db";
import { createBooking } from "./create";
import { BookingError } from "./errors";

const TZ = "America/Argentina/Buenos_Aires";

/** Un lunes lejano en el futuro, a la hora local pedida. */
function slotAt(hour: number, minute = 0): Date {
  return DateTime.fromISO("2099-01-01", { zone: TZ })
    .set({ weekday: 1 })
    .plus({ weeks: 1 })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toJSDate();
}

const CLIENT = { name: "Ana Gómez", phone: "11 2345 6789", email: "ana@test.local" };

beforeAll(async () => {
  await testPrisma.$connect();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

describe("createBooking — happy path", () => {
  it("crea el turno, el cliente y descuenta un turno gratis", async () => {
    const { serviceId } = await createTestBusiness({ slug: "acme" });

    const result = await createBooking(testPrisma, {
      slug: "acme",
      serviceId,
      startAt: slotAt(10),
      client: CLIENT,
    });

    expect(result.bookingId).toBeTruthy();
    expect(result.cancelToken).toBeTruthy();
    expect(result.freeBookingsRemaining).toBe(49);

    const booking = await testPrisma.booking.findUnique({
      where: { id: result.bookingId },
      include: { client: true },
    });
    expect(booking).not.toBeNull();
    expect(booking!.status).toBe("CONFIRMED");
    expect(booking!.source).toBe("PUBLIC");
    expect(booking!.serviceName).toBe("Servicio test");
    expect(booking!.client.phone).toBe("+5491123456789");
    expect(booking!.endAt.getTime() - booking!.startAt.getTime()).toBe(30 * 60_000);
  });

  it("con suscripción ACTIVE no toca la cuota gratis", async () => {
    const { serviceId } = await createTestBusiness({
      slug: "pro",
      subscriptionStatus: "ACTIVE",
    });

    const result = await createBooking(testPrisma, {
      slug: "pro",
      serviceId,
      startAt: slotAt(11),
      client: CLIENT,
    });

    expect(result.freeBookingsRemaining).toBeNull();
    const biz = await testPrisma.business.findFirst({ where: { slug: "pro" } });
    expect(biz?.freeBookingsUsed).toBe(0);
  });

  it("reusa el cliente por (comercio, teléfono) y actualiza el nombre", async () => {
    const { serviceId } = await createTestBusiness({ slug: "acme" });

    await createBooking(testPrisma, {
      slug: "acme",
      serviceId,
      startAt: slotAt(10),
      client: { ...CLIENT, name: "Ana" },
    });
    await createBooking(testPrisma, {
      slug: "acme",
      serviceId,
      startAt: slotAt(11),
      client: { ...CLIENT, name: "Ana María" },
    });

    const clients = await testPrisma.client.findMany();
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toBe("Ana María");
  });
});

describe("createBooking — rechazos", () => {
  it("IN_THE_PAST si el turno ya pasó", async () => {
    const { serviceId } = await createTestBusiness({ slug: "acme" });
    await expect(
      createBooking(testPrisma, {
        slug: "acme",
        serviceId,
        startAt: new Date(Date.now() - 3_600_000),
        client: CLIENT,
      }),
    ).rejects.toMatchObject({ code: "IN_THE_PAST" } satisfies Partial<BookingError>);
  });

  it("SLOT_UNAVAILABLE fuera del horario de trabajo", async () => {
    const { serviceId } = await createTestBusiness({ slug: "acme" });
    await expect(
      createBooking(testPrisma, {
        slug: "acme",
        serviceId,
        startAt: slotAt(20),
        client: CLIENT,
      }),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("SLOT_UNAVAILABLE si el profesional ya tiene un turno ahí", async () => {
    const { serviceId, professionalIds } = await createTestBusiness({ slug: "acme" });
    const proA = professionalIds[0];

    await createBooking(testPrisma, {
      slug: "acme",
      serviceId,
      professionalId: proA,
      startAt: slotAt(10),
      client: CLIENT,
    });

    await expect(
      createBooking(testPrisma, {
        slug: "acme",
        serviceId,
        professionalId: proA,
        startAt: slotAt(10),
        client: { ...CLIENT, phone: "11 9999 8888" },
      }),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("CLIENT_BLOCKED si el cliente está bloqueado por ausencias", async () => {
    const { businessId, serviceId } = await createTestBusiness({ slug: "acme" });
    await testPrisma.client.create({
      data: {
        businessId,
        phone: "+5491123456789",
        name: "Ana",
        blockedUntil: new Date(Date.now() + 7 * 86_400_000),
      },
    });

    await expect(
      createBooking(testPrisma, {
        slug: "acme",
        serviceId,
        startAt: slotAt(10),
        client: CLIENT,
      }),
    ).rejects.toMatchObject({ code: "CLIENT_BLOCKED" });
  });

  it("QUOTA_EXCEEDED cuando se agotó el pool gratis", async () => {
    const { serviceId } = await createTestBusiness({
      slug: "acme",
      freeBookingsQuota: 50,
      freeBookingsUsed: 50,
    });

    await expect(
      createBooking(testPrisma, {
        slug: "acme",
        serviceId,
        startAt: slotAt(10),
        client: CLIENT,
      }),
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });

  it("SERVICE_NOT_FOUND con un servicio de otro comercio", async () => {
    await createTestBusiness({ slug: "acme" });
    const other = await createTestBusiness({ slug: "otro" });
    await expect(
      createBooking(testPrisma, {
        slug: "acme",
        serviceId: other.serviceId,
        startAt: slotAt(10),
        client: CLIENT,
      }),
    ).rejects.toMatchObject({ code: "SERVICE_NOT_FOUND" });
  });
});

describe("createBooking — asignación y concurrencia", () => {
  it('"cualquiera" asigna al profesional menos cargado ese día', async () => {
    const { businessId, serviceId, professionalIds } = await createTestBusiness({
      slug: "acme",
    });
    const [proA, proB] = professionalIds;

    // proA ya tiene un turno ese día (insertado directo).
    const client = await testPrisma.client.create({
      data: { businessId, phone: "+5491100000001", name: "X" },
    });
    await testPrisma.booking.create({
      data: {
        businessId,
        professionalId: proA,
        serviceId,
        clientId: client.id,
        startAt: slotAt(9),
        endAt: slotAt(9, 30),
        serviceName: "Servicio test",
        clientName: "X",
      },
    });

    const result = await createBooking(testPrisma, {
      slug: "acme",
      serviceId,
      startAt: slotAt(10),
      client: CLIENT,
    });

    expect(result.professional.id).toBe(proB);
  });

  it("dos reservas concurrentes para el mismo slot → exactamente una gana", async () => {
    const { serviceId, professionalIds } = await createTestBusiness({ slug: "acme" });
    const proA = professionalIds[0];

    const results = await Promise.allSettled([
      createBooking(testPrisma, {
        slug: "acme",
        serviceId,
        professionalId: proA,
        startAt: slotAt(14),
        client: { ...CLIENT, phone: "11 1111 1111" },
      }),
      createBooking(testPrisma, {
        slug: "acme",
        serviceId,
        professionalId: proA,
        startAt: slotAt(14),
        client: { ...CLIENT, phone: "11 2222 2222" },
      }),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(BookingError);

    const count = await testPrisma.booking.count({
      where: { professionalId: proA, startAt: slotAt(14) },
    });
    expect(count).toBe(1);
  });
});
