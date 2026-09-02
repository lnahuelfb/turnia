import { type NextRequest } from "next/server";
import { buildIcs } from "@/lib/booking/ics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/turnos/[token]/ics — archivo de calendario del turno. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  const booking = await prisma.booking.findUnique({
    where: { cancelToken: token },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      serviceName: true,
      professional: { select: { name: true } },
      business: { select: { name: true, addressText: true } },
    },
  });
  if (!booking) {
    return new Response("Turno no encontrado", { status: 404 });
  }

  const ics = buildIcs({
    uid: `${booking.id}@turnia`,
    start: booking.startAt,
    end: booking.endAt,
    summary: `${booking.serviceName} — ${booking.business.name}`,
    description: `Turno con ${booking.professional.name}.`,
    location: booking.business.addressText ?? undefined,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="turno.ics"',
      "Cache-Control": "no-store",
    },
  });
}
