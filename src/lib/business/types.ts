/** Tipos compartidos de la página pública (importables desde cliente y server). */

export interface PublicBusinessPage {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  bio: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  timezone: string;
  whatsappPhone: string;
  publicEmail: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  addressText: string | null;
  vacationUntil: string | null;
  services: PublicService[];
  professionals: PublicProfessional[];
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceArs: string | null;
  showPrice: boolean;
  /** Ids de profesionales activos que ofrecen este servicio. */
  professionalIds: string[];
}

export interface PublicProfessional {
  id: string;
  name: string;
  photoUrl: string | null;
}
