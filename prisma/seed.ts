import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed de desarrollo: un comercio de ejemplo (peluquería) con 2 profesionales
 * y 3 servicios. Idempotente por slug.
 */
async function main() {
  const ownerId = "00000000-0000-0000-0000-000000000001";

  const user = await prisma.user.upsert({
    where: { id: ownerId },
    update: {},
    create: { id: ownerId, email: "demo@turnia.app", fullName: "Comercio Demo" },
  });

  const business = await prisma.business.upsert({
    where: { slug: "peluqueria-demo" },
    update: {},
    create: {
      ownerId: user.id,
      name: "Peluquería Demo",
      slug: "peluqueria-demo",
      category: "Peluquería",
      bio: "Cortes, color y tratamientos. Reservá tu turno online.",
      whatsappPhone: "+5491100000000",
      businessHours: {
        create: [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
          { weekday, startMinute: 9 * 60, endMinute: 13 * 60 },
          { weekday, startMinute: 16 * 60, endMinute: 20 * 60 },
        ]),
      },
      subscription: { create: { status: "TRIALING" } },
    },
  });

  const corte = await prisma.service.create({
    data: {
      businessId: business.id,
      name: "Corte de pelo",
      durationMin: 30,
      priceArs: new Prisma.Decimal("8000"),
      sortOrder: 1,
    },
  });

  const color = await prisma.service.create({
    data: {
      businessId: business.id,
      name: "Color",
      durationMin: 90,
      bufferAfterMin: 15,
      priceArs: new Prisma.Decimal("25000"),
      sortOrder: 2,
    },
  });

  const barba = await prisma.service.create({
    data: {
      businessId: business.id,
      name: "Barba",
      durationMin: 20,
      priceArs: new Prisma.Decimal("5000"),
      sortOrder: 3,
    },
  });

  await prisma.professional.create({
    data: {
      businessId: business.id,
      name: "Juan",
      sortOrder: 1,
      services: { create: [{ serviceId: corte.id }, { serviceId: barba.id }] },
    },
  });

  await prisma.professional.create({
    data: {
      businessId: business.id,
      name: "Camila",
      sortOrder: 2,
      services: { create: [{ serviceId: corte.id }, { serviceId: color.id }] },
    },
  });

  console.log(`Seed OK → /${business.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
