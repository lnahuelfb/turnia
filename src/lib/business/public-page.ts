import "server-only";
import { type PrismaClient } from "@prisma/client";
import type { PublicBusinessPage } from "./types";

export type {
  PublicBusinessPage,
  PublicProfessional,
  PublicService,
} from "./types";

export async function getPublicBusinessPage(
  prisma: PrismaClient,
  slug: string,
): Promise<PublicBusinessPage | null> {
  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      bio: true,
      logoUrl: true,
      coverUrl: true,
      timezone: true,
      whatsappPhone: true,
      publicEmail: true,
      instagramUrl: true,
      facebookUrl: true,
      websiteUrl: true,
      addressText: true,
      vacationUntil: true,
      professionals: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, photoUrl: true },
      },
      services: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          durationMin: true,
          priceArs: true,
          showPrice: true,
          professionals: {
            where: { professional: { active: true } },
            select: { professionalId: true },
          },
        },
      },
    },
  });

  if (!business) return null;

  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    category: business.category,
    bio: business.bio,
    logoUrl: business.logoUrl,
    coverUrl: business.coverUrl,
    timezone: business.timezone,
    whatsappPhone: business.whatsappPhone,
    publicEmail: business.publicEmail,
    instagramUrl: business.instagramUrl,
    facebookUrl: business.facebookUrl,
    websiteUrl: business.websiteUrl,
    addressText: business.addressText,
    vacationUntil: business.vacationUntil?.toISOString() ?? null,
    professionals: business.professionals,
    services: business.services
      // solo servicios que al menos un profesional activo ofrece
      .filter((s) => s.professionals.length > 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMin: s.durationMin,
        priceArs: s.priceArs?.toString() ?? null,
        showPrice: s.showPrice,
        professionalIds: s.professionals.map((p) => p.professionalId),
      })),
  };
}
