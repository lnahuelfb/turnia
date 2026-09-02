export {
  computeAvailableSlots,
  resolveWeeklyHours,
  type AvailabilityInput,
  type ServiceShape,
  type TimeRange,
  type WeeklyHours,
} from "./availability";

export {
  assembleAvailabilityInput,
  type AssembleParams,
  type BusinessConfig,
  type HolidayRow,
  type ProfessionalAgenda,
} from "./from-db";

// `queries.ts` es server-only (importa Prisma): importarlo directo desde
// `@/lib/availability/queries`, no se re-exporta acá.
