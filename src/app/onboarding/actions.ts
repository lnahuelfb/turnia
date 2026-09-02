"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser, syncUserRow } from "@/lib/auth";
import { normalizeArPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { SLUG_ERROR_MESSAGE, slugify, validateSlug } from "@/lib/slug";

const schema = z.object({
  name: z.string().trim().min(2, "Poné el nombre del comercio").max(120),
  slug: z.string().trim().min(1),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  whatsapp: z.string().trim().min(6).max(30),
});

export interface OnboardingState {
  error?: string;
  field?: "name" | "slug" | "whatsapp";
}

export async function createBusiness(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: first.path[0] as OnboardingState["field"] };
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);
  const slugError = validateSlug(slug);
  if (slugError) return { error: SLUG_ERROR_MESSAGE[slugError], field: "slug" };

  let whatsappPhone: string;
  try {
    whatsappPhone = normalizeArPhone(parsed.data.whatsapp);
  } catch {
    return { error: "Ingresá un celular argentino válido", field: "whatsapp" };
  }

  await syncUserRow(user);

  const existing = await prisma.business.findUnique({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (existing) redirect("/app");

  try {
    await prisma.business.create({
      data: {
        ownerId: user.id,
        name: parsed.data.name,
        slug,
        category: parsed.data.category || null,
        whatsappPhone,
        subscription: { create: { status: "TRIALING" } },
        professionals: { create: { name: parsed.data.name, sortOrder: 0 } },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = String(err.meta?.target ?? "");
      if (target.includes("slug")) return { error: "Ese link ya está en uso", field: "slug" };
      if (target.includes("whatsapp")) {
        return { error: "Ese WhatsApp ya está en otra cuenta", field: "whatsapp" };
      }
    }
    throw err;
  }

  redirect("/app");
}
