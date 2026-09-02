import { DateTime } from "luxon";
import { type Interval, mergeOverlapping, overlaps, subtractAll } from "./interval";

/**
 * Motor de disponibilidad. Función pura: dadas las reglas de agenda de un
 * profesional y sus turnos ocupados, calcula los horarios de inicio libres
 * para un servicio, dentro de una ventana.
 *
 * Convenciones (ver CLAUDE.md):
 *  - Los instantes de entrada y salida son UTC (`Date`).
 *  - Los horarios semanales son minutos desde la medianoche LOCAL + weekday
 *    (0=domingo … 6=sábado).
 *  - La conversión local↔UTC se hace con la `timezone` provista; no se
 *    hardcodea ningún offset. (No se contemplan transiciones de horario de
 *    verano DENTRO de una franja de trabajo — Argentina no tiene DST.)
 */

export interface WeeklyHours {
  /** 0=domingo … 6=sábado (igual que `Date.getDay()`). */
  weekday: number;
  /** Minutos desde la medianoche local, `[0, 1440]`. */
  startMinute: number;
  /** Minutos desde la medianoche local, `[startMinute, 1440]`. */
  endMinute: number;
}

/** Rango de instantes UTC, semiabierto `[start, end)`. */
export interface TimeRange {
  start: Date;
  end: Date;
}

export interface ServiceShape {
  durationMin: number;
  /** Preparación antes del turno (minutos). Solo cuenta contra otros turnos. */
  bufferBeforeMin: number;
  /** Limpieza / margen después del turno (minutos). */
  bufferAfterMin: number;
}

export interface AvailabilityInput {
  timezone: string;
  /** Ventana a calcular (instantes UTC). */
  from: Date;
  to: Date;
  /** Horarios semanales ya resueltos (ver `resolveWeeklyHours`). */
  workingHours: WeeklyHours[];
  service: ServiceShape;
  /** Paso de la grilla de horarios, en minutos (p. ej. 15). */
  slotGranularityMin: number;
  /** Turnos activos del profesional (instantes UTC). */
  busy?: TimeRange[];
  /** Bloqueos puntuales y vacaciones que afectan al profesional (instantes UTC). */
  blocks?: TimeRange[];
  /** Fechas locales `YYYY-MM-DD` en las que el comercio no atiende (feriados). */
  closedDates?: string[];
  /** No ofrecer turnos que empiecen antes de este instante (default: ahora). */
  notBefore?: Date;
}

const MINUTE_MS = 60_000;

/**
 * Si el profesional tiene horarios propios cargados, se usan esos; si no, se
 * cae a los del comercio.
 */
export function resolveWeeklyHours(
  professionalHours: WeeklyHours[],
  businessHours: WeeklyHours[],
): WeeklyHours[] {
  return professionalHours.length > 0 ? professionalHours : businessHours;
}

export function computeAvailableSlots(input: AvailabilityInput): Date[] {
  const {
    timezone,
    workingHours,
    service,
    slotGranularityMin,
    busy = [],
    blocks = [],
    closedDates = [],
  } = input;

  if (service.durationMin <= 0 || slotGranularityMin <= 0) return [];

  const rangeStart = input.from.getTime();
  const rangeEnd = input.to.getTime();
  if (rangeEnd <= rangeStart) return [];

  const notBefore = (input.notBefore ?? new Date()).getTime();
  const closed = new Set(closedDates);

  const busyIv = toIntervals(busy);
  const blockIv = mergeOverlapping(toIntervals(blocks));

  const stepMs = slotGranularityMin * MINUTE_MS;
  const durationMs = service.durationMin * MINUTE_MS;
  const bufferBeforeMs = service.bufferBeforeMin * MINUTE_MS;
  const bufferAfterMs = service.bufferAfterMin * MINUTE_MS;

  const slots = new Set<number>();

  const firstDay = DateTime.fromJSDate(input.from, { zone: timezone }).startOf("day");
  const lastDay = DateTime.fromJSDate(input.to, { zone: timezone }).startOf("day");

  for (let day = firstDay; day <= lastDay; day = day.plus({ days: 1 })) {
    const isoDate = day.toISODate();
    if (isoDate && closed.has(isoDate)) continue;

    const weekday = day.weekday % 7; // luxon 1=lun..7=dom → 0=dom..6=sáb
    const dayHours = workingHours.filter((h) => h.weekday === weekday);
    if (dayHours.length === 0) continue;

    for (const wh of dayHours) {
      // `.plus({ minutes })` desde el inicio del día local: Luxon resuelve el
      // offset de la zona para esa fecha. Soporta endMinute = 1440 (medianoche).
      const work: Interval = {
        start: day.plus({ minutes: wh.startMinute }).toMillis(),
        end: day.plus({ minutes: wh.endMinute }).toMillis(),
      };
      if (work.end <= work.start) continue;

      for (const chunk of subtractAll(work, blockIv)) {
        // Los candidatos se alinean a la grilla desde el inicio de la FRANJA
        // de trabajo, no del chunk (que un bloqueo pudo cortar en un minuto raro).
        const firstK = Math.max(0, Math.ceil((chunk.start - work.start) / stepMs));

        for (let k = firstK; ; k++) {
          const slotStart = work.start + k * stepMs;
          const slotEnd = slotStart + durationMs;

          if (slotEnd > chunk.end) break;
          if (slotStart >= rangeEnd) break;
          if (slotStart < rangeStart || slotStart < notBefore) continue;

          const guarded: Interval = {
            start: slotStart - bufferBeforeMs,
            end: slotEnd + bufferAfterMs,
          };
          if (!busyIv.some((b) => overlaps(guarded, b))) {
            slots.add(slotStart);
          }
        }
      }
    }
  }

  return [...slots].sort((a, b) => a - b).map((ms) => new Date(ms));
}

function toIntervals(ranges: TimeRange[]): Interval[] {
  return ranges
    .map((r) => ({ start: r.start.getTime(), end: r.end.getTime() }))
    .filter((i) => i.end > i.start);
}
