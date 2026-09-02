import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  AvailabilityNotFoundError,
  getPublicAvailability,
} from "@/lib/availability/queries";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_WINDOW_DAYS = 60;
const DEFAULT_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

const querySchema = z.object({
  servicio: z.string().uuid(),
  profesional: z.string().uuid().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

/**
 * GET /api/[slug]/disponibilidad?servicio=<uuid>&profesional=<uuid>&desde=&hasta=
 *
 * Horarios libres para reservar un servicio en la página pública de un comercio.
 * Sin auth (los clientes no tienen cuenta).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", detalle: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const now = new Date();
  const from = parsed.data.desde ?? now;
  const to = parsed.data.hasta ?? new Date(now.getTime() + DEFAULT_WINDOW_DAYS * DAY_MS);

  if (to.getTime() <= from.getTime()) {
    return NextResponse.json({ error: "'hasta' debe ser posterior a 'desde'" }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_WINDOW_DAYS * DAY_MS) {
    return NextResponse.json(
      { error: `La ventana no puede superar ${MAX_WINDOW_DAYS} días` },
      { status: 400 },
    );
  }

  try {
    const result = await getPublicAvailability(prisma, {
      slug,
      serviceId: parsed.data.servicio,
      professionalId: parsed.data.profesional ?? null,
      from,
      to,
      notBefore: now,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof AvailabilityNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
