import "server-only";
import { type PrismaClient } from "@prisma/client";

export type CancelErrorCode = "NOT_FOUND" | "ALREADY_STARTED";

export class CancelError extends Error {
  constructor(public readonly code: CancelErrorCode) {
    super(code);
    this.name = "CancelError";
  }
}

export interface CancelResult {
  outcome: "cancelled" | "already_cancelled";
  serviceName: string;
  professionalName: string;
  startAt: string;
  business: { name: string; slug: string; timezone: string };
}

/**
 * Cancela un turno por su `cancelToken` (opaco, no expone el id). Idempotente:
 * si ya estaba cancelado devuelve `already_cancelled` sin error. Libera el
 * slot al instante (el estado deja de estar en los "activos").
 *
 * MVP: no descuenta la cuota gratis ni aplica política de cancelación tardía
 * (eso es parte del anti-ausencias, todavía no implementado).
 */
export async function cancelBooking(
  prisma: PrismaClient,
  token: string,
  now: Date = new Date(),
): Promise<CancelResult> {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { cancelToken: token },
      select: {
        id: true,
        status: true,
        startAt: true,
        serviceName: true,
        professional: { select: { name: true } },
        business: { select: { name: true, slug: true, timezone: true } },
      },
    });
    if (!booking) throw new CancelError("NOT_FOUND");

    const summary: Omit<CancelResult, "outcome"> = {
      serviceName: booking.serviceName,
      professionalName: booking.professional.name,
      startAt: booking.startAt.toISOString(),
      business: booking.business,
    };

    if (
      booking.status === "CANCELLED_BY_CLIENT" ||
      booking.status === "CANCELLED_BY_BUSINESS"
    ) {
      return { outcome: "already_cancelled", ...summary };
    }

    if (
      booking.status === "COMPLETED" ||
      booking.status === "NO_SHOW" ||
      booking.startAt.getTime() <= now.getTime()
    ) {
      throw new CancelError("ALREADY_STARTED");
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED_BY_CLIENT", cancelledAt: now },
    });

    return { outcome: "cancelled", ...summary };
  });
}
