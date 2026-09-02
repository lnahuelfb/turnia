-- Restricción anti-solapamiento de turnos.
-- Prisma no genera constraints de exclusión: se aplica a mano (idempotente).
-- Impide que un mismo profesional tenga dos turnos activos que se pisen.
-- Los instantes se guardan en UTC (columnas timestamp(3)); usamos tsrange.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS booking_no_overlap;

ALTER TABLE "bookings"
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "professionalId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE ("status" IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW'));
