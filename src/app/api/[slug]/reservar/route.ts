import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createBooking } from "@/lib/booking/create";
import { BOOKING_ERROR_STATUS, BookingError } from "@/lib/booking/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  servicio: z.string().uuid(),
  profesional: z.string().uuid().nullish(),
  inicio: z.coerce.date(),
  cliente: z.object({
    nombre: z.string().trim().min(2).max(120),
    whatsapp: z.string().trim().min(6).max(30),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
  }),
});

/**
 * POST /api/[slug]/reservar
 *
 * Crea un turno. Chequeo de disponibilidad + insert en una sola transacción;
 * el constraint `booking_no_overlap` es la red de seguridad ante carreras.
 * Sin auth (los clientes no tienen cuenta).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_INPUT", message: "Body inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", detalle: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await createBooking(prisma, {
      slug,
      serviceId: parsed.data.servicio,
      professionalId: parsed.data.profesional ?? null,
      startAt: parsed.data.inicio,
      client: {
        name: parsed.data.cliente.nombre,
        phone: parsed.data.cliente.whatsapp,
        email: parsed.data.cliente.email || null,
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: BOOKING_ERROR_STATUS[err.code] },
      );
    }
    throw err;
  }
}
