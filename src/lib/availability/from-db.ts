import { DateTime } from "luxon";
import {
  type AvailabilityInput,
  resolveWeeklyHours,
  type ServiceShape,
  type TimeRange,
  type WeeklyHours,
} from "./availability";

/**
 * Traducción de filas de la base al `AvailabilityInput` del motor. Puro: no
 * toca Prisma, recibe los datos ya cargados. Las queries viven en `queries.ts`.
 */

export interface BusinessConfig {
  timezone: string;
  slotGranularityMin: number;
  /** `Business.vacationUntil` — cierre temporal hasta este instante (UTC). */
  vacationUntil: Date | null;
  /** Horario semanal general del comercio (fallback si el profesional no tiene). */
  businessHours: WeeklyHours[];
}

export interface ProfessionalAgenda {
  /** Horario semanal propio del profesional (puede estar vacío). */
  workingHours: WeeklyHours[];
  /** Turnos que ocupan la agenda — el llamador ya filtró por estado y ventana. */
  bookings: TimeRange[];
  /** Bloqueos del profesional + del comercio (`TimeOff` con professionalId null). */
  timeOff: TimeRange[];
}

export interface HolidayRow {
  /** `Holiday.date` (`@db.Date`): Prisma lo trae como Date a medianoche UTC. */
  date: Date | string;
  works: boolean;
}

export interface AssembleParams {
  business: BusinessConfig;
  professional: ProfessionalAgenda;
  service: ServiceShape;
  from: Date;
  to: Date;
  holidays: HolidayRow[];
  notBefore?: Date;
}

export function assembleAvailabilityInput(p: AssembleParams): AvailabilityInput {
  const blocks: TimeRange[] = [...p.professional.timeOff];

  // Modo vacaciones "rápido": bloquea todo hasta vacationUntil.
  if (p.business.vacationUntil) {
    blocks.push({ start: new Date(0), end: p.business.vacationUntil });
  }

  const closedDates = p.holidays
    .filter((h) => !h.works)
    .map((h) => holidayIsoDate(h.date));

  return {
    timezone: p.business.timezone,
    from: p.from,
    to: p.to,
    workingHours: resolveWeeklyHours(
      p.professional.workingHours,
      p.business.businessHours,
    ),
    service: p.service,
    slotGranularityMin: p.business.slotGranularityMin,
    busy: p.professional.bookings,
    blocks,
    closedDates,
    notBefore: p.notBefore,
  };
}

/**
 * La fecha calendario de un feriado es su parte `YYYY-MM-DD` en UTC (así lo
 * guarda `@db.Date`), no se reinterpreta en la zona del comercio.
 */
function holidayIsoDate(date: Date | string): string {
  if (typeof date === "string") return date.slice(0, 10);
  return DateTime.fromJSDate(date, { zone: "utc" }).toISODate() ?? "";
}
