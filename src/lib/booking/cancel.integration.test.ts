import { DateTime } from "luxon";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestBusiness, resetDb, testPrisma } from "@/test/db";
import { cancelBooking } from "./cancel";
import { createBooking } from "./create";
import { CancelError } from "./cancel";

const TZ = "America/Argentina/Buenos_Aires";

function slotAt(hour: number): Date {
  return DateTime.fromISO("2099-01-01", { zone: TZ })
    .set({ weekday: 1 })
    .plus({ weeks: 1 })
    .set({ hour, minute: 0, second: 0, millisecond: 0 })
    .toJSDate();
}

const CLIENT = { name: "Ana Gómez", phone: "11 2345 6789" };

beforeAll(() => testPrisma.$connect());
afterAll(() => testPrisma.$disconnect());
beforeEach(() => resetDb());

async function book(slug: string, serviceId: string, hour: number) {
  return createBooking(testPrisma, {
    slug,
    serviceId,
    startAt: slotAt(hour),
    client: CLIENT,
  });
}

describe("cancelBooking", () => {
  it("cancela el turno y libera el slot", async () => {
    const { serviceId, professionalIds } = await createTestBusiness({ slug: "acme" });
    const first = await createBooking(testPrisma, {
      slug: "acme",
      serviceId,
      professionalId: professionalIds[0],
      startAt: slotAt(10),
      client: CLIENT,
    });

    const result = await cancelBooking(testPrisma, first.cancelToken);
    expect(result.outcome).toBe("cancelled");

    const booking = await testPrisma.booking.findUnique({
      where: { id: first.bookingId },
    });
    expect(booking?.status).toBe("CANCELLED_BY_CLIENT");
    expect(booking?.cancelledAt).not.toBeNull();

    // El mismo profesional puede volver a tomar ese horario.
    const again = await createBooking(testPrisma, {
      slug: "acme",
      serviceId,
      professionalId: professionalIds[0],
      startAt: slotAt(10),
      client: { name: "Otro", phone: "11 9999 0000" },
    });
    expect(again.bookingId).toBeTruthy();
  });

  it("es idempotente: cancelar dos veces no falla", async () => {
    const { serviceId } = await createTestBusiness({ slug: "acme" });
    const b = await book("acme", serviceId, 11);

    const first = await cancelBooking(testPrisma, b.cancelToken);
    const second = await cancelBooking(testPrisma, b.cancelToken);
    expect(first.outcome).toBe("cancelled");
    expect(second.outcome).toBe("already_cancelled");
  });

  it("token inexistente → NOT_FOUND", async () => {
    await expect(cancelBooking(testPrisma, "no-existe")).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<CancelError>);
  });

  it("turno ya empezado → ALREADY_STARTED", async () => {
    const { businessId, serviceId, professionalIds } = await createTestBusiness({
      slug: "acme",
    });
    const client = await testPrisma.client.create({
      data: { businessId, phone: "+5491100000009", name: "Z" },
    });
    const past = await testPrisma.booking.create({
      data: {
        businessId,
        professionalId: professionalIds[0],
        serviceId,
        clientId: client.id,
        startAt: new Date(Date.now() - 3_600_000),
        endAt: new Date(Date.now() - 1_800_000),
        serviceName: "Servicio test",
        clientName: "Z",
      },
    });

    await expect(
      cancelBooking(testPrisma, past.cancelToken),
    ).rejects.toMatchObject({ code: "ALREADY_STARTED" });
  });
});
