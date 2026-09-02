import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * Helpers para los tests de integración. `DATABASE_URL` tiene que apuntar a
 * una base descartable (el service container de CI, o una Postgres local).
 */

export const testPrisma = new PrismaClient({ log: ["error"] });

/** Borra todo. `users` y `businesses` cascadean al resto del modelo. */
export async function resetDb() {
  await testPrisma.$executeRawUnsafe(
    'TRUNCATE TABLE "users", "businesses" RESTART IDENTITY CASCADE',
  );
}

export interface TestBusinessOptions {
  slug?: string;
  timezone?: string;
  slotGranularityMin?: number;
  freeBookingsQuota?: number;
  freeBookingsUsed?: number;
  /** minutos locales; default lun–vie 09:00–17:00. */
  hours?: { weekday: number; startMinute: number; endMinute: number }[];
  serviceDurationMin?: number;
  bufferAfterMin?: number;
  professionalNames?: string[];
  subscriptionStatus?: "TRIALING" | "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELLED";
}

export interface TestBusiness {
  businessId: string;
  serviceId: string;
  professionalIds: string[];
}

const WEEKDAY_HOURS = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

export async function createTestBusiness(
  opts: TestBusinessOptions = {},
): Promise<TestBusiness> {
  const suffix = randomUUID().slice(0, 8);
  const phoneDigits = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const user = await testPrisma.user.create({
    data: { id: randomUUID(), email: `owner-${suffix}@test.local` },
  });

  const business = await testPrisma.business.create({
    data: {
      ownerId: user.id,
      name: `Test ${suffix}`,
      slug: opts.slug ?? `test-${suffix}`,
      whatsappPhone: `+54911${phoneDigits}`,
      timezone: opts.timezone ?? "America/Argentina/Buenos_Aires",
      slotGranularityMin: opts.slotGranularityMin ?? 30,
      freeBookingsQuota: opts.freeBookingsQuota ?? 50,
      freeBookingsUsed: opts.freeBookingsUsed ?? 0,
      businessHours: { create: opts.hours ?? WEEKDAY_HOURS },
      subscription: { create: { status: opts.subscriptionStatus ?? "TRIALING" } },
    },
  });

  const service = await testPrisma.service.create({
    data: {
      businessId: business.id,
      name: "Servicio test",
      durationMin: opts.serviceDurationMin ?? 30,
      bufferAfterMin: opts.bufferAfterMin ?? 0,
      priceArs: "1000",
    },
  });

  const names = opts.professionalNames ?? ["Pro A", "Pro B"];
  const professionalIds: string[] = [];
  for (let i = 0; i < names.length; i++) {
    const pro = await testPrisma.professional.create({
      data: {
        businessId: business.id,
        name: names[i],
        sortOrder: i,
        services: { create: { serviceId: service.id } },
      },
    });
    professionalIds.push(pro.id);
  }

  return { businessId: business.id, serviceId: service.id, professionalIds };
}
