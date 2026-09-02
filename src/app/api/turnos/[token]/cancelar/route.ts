import { NextResponse, type NextRequest } from "next/server";
import { cancelBooking, CancelError } from "@/lib/booking/cancel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** POST /api/turnos/[token]/cancelar — cancela el turno (idempotente). */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  try {
    const result = await cancelBooking(prisma, token);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof CancelError) {
      const status = err.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: err.code }, { status });
    }
    throw err;
  }
}
