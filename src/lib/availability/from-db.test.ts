import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { computeAvailableSlots } from "./availability";
import { type AssembleParams, assembleAvailabilityInput } from "./from-db";

const TZ = "America/Argentina/Buenos_Aires";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ }).toJSDate();

function params(overrides: Partial<AssembleParams> = {}): AssembleParams {
  return {
    business: {
      timezone: TZ,
      slotGranularityMin: 30,
      vacationUntil: null,
      businessHours: [{ weekday: 1, startMinute: 540, endMinute: 720 }],
    },
    professional: { workingHours: [], bookings: [], timeOff: [] },
    service: { durationMin: 30, bufferBeforeMin: 0, bufferAfterMin: 0 },
    from: at("2026-03-09T00:00"),
    to: at("2026-03-09T23:59"),
    holidays: [],
    notBefore: at("2026-01-01T00:00"),
    ...overrides,
  };
}

describe("assembleAvailabilityInput", () => {
  it("usa los horarios del comercio si el profesional no tiene", () => {
    const input = assembleAvailabilityInput(params());
    expect(input.workingHours).toEqual([{ weekday: 1, startMinute: 540, endMinute: 720 }]);
  });

  it("usa los horarios del profesional si los tiene", () => {
    const profHours = [{ weekday: 1, startMinute: 600, endMinute: 660 }];
    const input = assembleAvailabilityInput(
      params({ professional: { workingHours: profHours, bookings: [], timeOff: [] } }),
    );
    expect(input.workingHours).toBe(profHours);
  });

  it("pasa los turnos como `busy` y el timeOff como `blocks`", () => {
    const bookings = [{ start: at("2026-03-09T10:00"), end: at("2026-03-09T10:30") }];
    const timeOff = [{ start: at("2026-03-09T11:00"), end: at("2026-03-09T12:00") }];
    const input = assembleAvailabilityInput(
      params({ professional: { workingHours: [], bookings, timeOff } }),
    );
    expect(input.busy).toBe(bookings);
    expect(input.blocks).toEqual(timeOff);
  });

  it("vacationUntil se agrega como bloqueo desde epoch 0", () => {
    const vacationUntil = at("2026-03-20T00:00");
    const input = assembleAvailabilityInput(
      params({ business: { ...params().business, vacationUntil } }),
    );
    expect(input.blocks).toContainEqual({ start: new Date(0), end: vacationUntil });
  });

  it("feriados con works=false van a closedDates; works=true no", () => {
    const input = assembleAvailabilityInput(
      params({
        holidays: [
          { date: new Date("2026-03-09T00:00:00.000Z"), works: false },
          { date: "2026-03-16", works: false },
          { date: new Date("2026-03-23T00:00:00.000Z"), works: true },
        ],
      }),
    );
    expect(input.closedDates).toEqual(["2026-03-09", "2026-03-16"]);
  });

  it("un feriado @db.Date no se corre de día al pasar por la zona del comercio", () => {
    // Medianoche UTC del 9 = 21:00 del 8 en Argentina. Debe seguir siendo "09".
    const input = assembleAvailabilityInput(
      params({ holidays: [{ date: new Date("2026-03-09T00:00:00.000Z"), works: false }] }),
    );
    expect(input.closedDates).toEqual(["2026-03-09"]);
  });

  it("integra con el motor: feriado → sin slots ese día", () => {
    const input = assembleAvailabilityInput(
      params({ holidays: [{ date: "2026-03-09", works: false }] }),
    );
    expect(computeAvailableSlots(input)).toEqual([]);
  });

  it("integra con el motor: día normal → slots esperados", () => {
    const slots = computeAvailableSlots(assembleAvailabilityInput(params()));
    expect(slots.map((d) => DateTime.fromJSDate(d, { zone: TZ }).toFormat("HH:mm"))).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    ]);
  });
});
