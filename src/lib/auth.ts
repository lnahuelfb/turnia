import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/** Usuario logueado (de Supabase Auth) o `null`. */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Igual que `getUser` pero redirige a /login si no hay sesión. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Sincroniza el espejo `public.users` con la sesión (se llama en el callback). */
export async function syncUserRow(user: User): Promise<void> {
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;
  await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email ?? "", fullName },
    update: { email: user.email ?? "" },
  });
}

export type MyBusiness = NonNullable<Awaited<ReturnType<typeof getMyBusiness>>>;

/**
 * El comercio del usuario, o `null` si todavía no completó el onboarding.
 * `cache()` lo deduplica entre layout y página dentro de una misma request.
 */
export const getMyBusiness = cache(async function getMyBusiness(userId: string) {
  return prisma.business.findUnique({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      slug: true,
      whatsappPhone: true,
      timezone: true,
      vacationUntil: true,
      freeBookingsQuota: true,
      freeBookingsUsed: true,
      subscription: { select: { status: true, currentPeriodEnd: true } },
    },
  });
});
