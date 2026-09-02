import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  type AvailabilityInput,
  computeAvailableSlots,
  resolveWeeklyHours,
  type WeeklyHours,
} from "./availability";

const TZ = "America/Argentina/Buenos_Aires";

/** Instante UTC a partir de una hora de pared local argentina. */
function at(iso: string): Date {
  return DateTime.fromISO(iso, { zone: TZ }).toJSDate();
}

/** Slots como `HH:mm` local, para asserts legibles. */
function hhmm(slots: Date[]): string[] {
  return slots.map((d) => DateTime.fromJSDate(d, { zone: TZ }).toFormat("HH:mm"));
}

/** Slots como `yyyy-MM-dd HH:mm` local. */
function stamp(slots: Date[]): string[] {
  return slots.map((d) => DateTime.fromJSDate(d, { zone: TZ }).toFormat("yyyy-MM-dd HH:mm"));
}

// Lunes 2026-03-09. weekday 1.
const MON = "2026-03-09";
const mondayHours: WeeklyHours[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }];

function baseInput(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    timezone: TZ,
    from: at(`${MON}T00:00`),
    to: at(`${MON}T23:59`),
    workingHours: mondayHours,
    service: { durationMin: 30, bufferBeforeMin: 0, bufferAfterMin: 0 },
    slotGranularityMin: 30,
    notBefore: at("2026-01-01T00:00"),
    ...overrides,
  };
}

describe("computeAvailableSlots — básico", () => {
  it("genera slots en la grilla dentro de la franja", () => {
    expect(hhmm(computeAvailableSlots(baseInput()))).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
    ]);
  });

  it("el último slot no se pasa del cierre", () => {
    const slots = computeAvailableSlots(
      baseInput({ service: { durationMin: 45, bufferBeforeMin: 0, bufferAfterMin: 0 } }),
    );
    // 11:30 + 45min = 12:15 > 12:00 → no entra
    expect(hhmm(slots)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("respeta la granularidad de 15", () => {
    const slots = computeAvailableSlots(baseInput({ slotGranularityMin: 15 }));
    expect(hhmm(slots)).toEqual([
      "09:00", "09:15", "09:30", "09:45",
      "10:00", "10:15", "10:30", "10:45",
      "11:00", "11:15", "11:30",
    ]);
  });

  it("duración o granularidad inválidas → sin slots", () => {
    expect(computeAvailableSlots(baseInput({ service: { durationMin: 0, bufferBeforeMin: 0, bufferAfterMin: 0 } }))).toEqual([]);
    expect(computeAvailableSlots(baseInput({ slotGranularityMin: 0 }))).toEqual([]);
  });

  it("ventana from/to al revés → sin slots", () => {
    expect(computeAvailableSlots(baseInput({ from: at(`${MON}T12:00`), to: at(`${MON}T09:00`) }))).toEqual([]);
  });

  it("franja degenerada (inicio >= fin) se ignora", () => {
    const input = baseInput({
      workingHours: [
        { weekday: 1, startMinute: 12 * 60, endMinute: 9 * 60 },
        { weekday: 1, startMinute: 10 * 60, endMinute: 11 * 60 },
      ],
    });
    expect(hhmm(computeAvailableSlots(input))).toEqual(["10:00", "10:30"]);
  });
});

describe("computeAvailableSlots — turnos ocupados y buffers", () => {
  it("un turno ocupado bloquea los slots que se solapan", () => {
    const slots = computeAvailableSlots(
      baseInput({
        slotGranularityMin: 15,
        busy: [{ start: at(`${MON}T10:00`), end: at(`${MON}T10:30`) }],
      }),
    );
    expect(hhmm(slots)).not.toContain("09:45"); // [09:45,10:15) pisa [10:00,10:30)
    expect(hhmm(slots)).not.toContain("10:00");
    expect(hhmm(slots)).not.toContain("10:15");
    expect(hhmm(slots)).toContain("09:30"); // [09:30,10:00) no pisa
    expect(hhmm(slots)).toContain("10:30"); // arranca justo al liberarse
  });

  it("el buffer posterior del servicio agranda el bloqueo", () => {
    const slots = computeAvailableSlots(
      baseInput({
        slotGranularityMin: 15,
        service: { durationMin: 30, bufferBeforeMin: 0, bufferAfterMin: 15 },
        busy: [{ start: at(`${MON}T10:00`), end: at(`${MON}T10:30`) }],
      }),
    );
    // [09:30,10:00)+15min after = guardado [09:30,10:15) → pisa el turno
    expect(hhmm(slots)).not.toContain("09:30");
    expect(hhmm(slots)).toContain("09:15");
  });

  it("el buffer previo del servicio bloquea slots después del turno ocupado", () => {
    const slots = computeAvailableSlots(
      baseInput({
        slotGranularityMin: 15,
        service: { durationMin: 30, bufferBeforeMin: 15, bufferAfterMin: 0 },
        busy: [{ start: at(`${MON}T10:00`), end: at(`${MON}T10:30`) }],
      }),
    );
    // 10:30 con buffer previo 15 → guardado [10:15,11:00) pisa [10:00,10:30)
    expect(hhmm(slots)).not.toContain("10:30");
    expect(hhmm(slots)).toContain("10:45");
  });
});

describe("computeAvailableSlots — bloqueos, feriados, vacaciones", () => {
  it("un bloqueo (TimeOff) recorta la franja", () => {
    const slots = computeAvailableSlots(
      baseInput({
        slotGranularityMin: 30,
        blocks: [{ start: at(`${MON}T10:00`), end: at(`${MON}T11:00`) }],
      }),
    );
    expect(hhmm(slots)).toEqual(["09:00", "09:30", "11:00", "11:30"]);
  });

  it("los candidatos siguen alineados a la grilla de la franja tras un bloqueo", () => {
    const slots = computeAvailableSlots(
      baseInput({
        slotGranularityMin: 30,
        blocks: [{ start: at(`${MON}T10:10`), end: at(`${MON}T10:40`) }],
      }),
    );
    // el chunk libre arranca 10:40 pero el próximo punto de grilla es 11:00
    expect(hhmm(slots)).toEqual(["09:00", "09:30", "11:00", "11:30"]);
  });

  it("closedDates cierra el día entero", () => {
    expect(computeAvailableSlots(baseInput({ closedDates: [MON] }))).toEqual([]);
  });

  it("un bloqueo multi-día (vacaciones) tapa todo", () => {
    const slots = computeAvailableSlots(
      baseInput({
        blocks: [{ start: at("2026-03-01T00:00"), end: at("2026-03-15T00:00") }],
      }),
    );
    expect(slots).toEqual([]);
  });
});

describe("computeAvailableSlots — semana y timezone", () => {
  it("weekday 0 = domingo", () => {
    const SUN = "2026-03-08";
    const input = baseInput({
      from: at(`${SUN}T00:00`),
      to: at(`${SUN}T23:59`),
      workingHours: [{ weekday: 0, startMinute: 10 * 60, endMinute: 11 * 60 }],
    });
    expect(hhmm(computeAvailableSlots(input))).toEqual(["10:00", "10:30"]);
  });

  it("no hay slots un día sin horario cargado", () => {
    const TUE = "2026-03-10";
    const input = baseInput({ from: at(`${TUE}T00:00`), to: at(`${TUE}T23:59`) });
    expect(computeAvailableSlots(input)).toEqual([]);
  });

  it("el slot local se emite como el instante UTC correcto (AR = UTC-3)", () => {
    const [first] = computeAvailableSlots(baseInput());
    expect(first.toISOString()).toBe("2026-03-09T12:00:00.000Z");
  });

  it("Argentina no tiene horario de verano: 09:00 local = 12:00Z todo el año", () => {
    for (const date of ["2026-03-09", "2026-07-06", "2026-11-09"]) {
      const wd = DateTime.fromISO(date, { zone: TZ }).weekday % 7;
      const slots = computeAvailableSlots(
        baseInput({
          from: at(`${date}T00:00`),
          to: at(`${date}T23:59`),
          workingHours: [{ weekday: wd, startMinute: 9 * 60, endMinute: 10 * 60 }],
        }),
      );
      expect(slots[0].toISOString().slice(11, 16)).toBe("12:00");
    }
  });

  it("franja partida: sin slots en el hueco del mediodía", () => {
    const SAT = "2026-03-14";
    const input = baseInput({
      from: at(`${SAT}T00:00`),
      to: at(`${SAT}T23:59`),
      slotGranularityMin: 60,
      workingHours: [
        { weekday: 6, startMinute: 9 * 60, endMinute: 13 * 60 },
        { weekday: 6, startMinute: 16 * 60, endMinute: 20 * 60 },
      ],
    });
    expect(hhmm(computeAvailableSlots(input))).toEqual([
      "09:00", "10:00", "11:00", "12:00",
      "16:00", "17:00", "18:00", "19:00",
    ]);
  });

  it("endMinute 1440: atiende hasta medianoche", () => {
    const input = baseInput({
      slotGranularityMin: 30,
      from: at(`${MON}T21:00`),
      to: at("2026-03-10T02:00"),
      workingHours: [{ weekday: 1, startMinute: 22 * 60, endMinute: 24 * 60 }],
    });
    expect(stamp(computeAvailableSlots(input))).toEqual([
      "2026-03-09 22:00",
      "2026-03-09 22:30",
      "2026-03-09 23:00",
      "2026-03-09 23:30",
    ]);
  });
});

describe("computeAvailableSlots — ventana y lead time", () => {
  it("no ofrece slots antes de notBefore", () => {
    const slots = computeAvailableSlots(
      baseInput({ notBefore: at(`${MON}T10:15`) }),
    );
    expect(hhmm(slots)).toEqual(["10:30", "11:00", "11:30"]);
  });

  it("recorta por el fin de la ventana `to`", () => {
    const slots = computeAvailableSlots(baseInput({ to: at(`${MON}T10:30`) }));
    // slotStart >= 10:30 queda afuera
    expect(hhmm(slots)).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("recorre varios días", () => {
    const input = baseInput({
      from: at(`${MON}T00:00`),
      to: at("2026-03-16T23:59"), // lunes siguiente
      slotGranularityMin: 60,
      workingHours: [{ weekday: 1, startMinute: 9 * 60, endMinute: 11 * 60 }],
    });
    expect(stamp(computeAvailableSlots(input))).toEqual([
      "2026-03-09 09:00",
      "2026-03-09 10:00",
      "2026-03-16 09:00",
      "2026-03-16 10:00",
    ]);
  });
});

describe("resolveWeeklyHours", () => {
  const biz: WeeklyHours[] = [{ weekday: 1, startMinute: 540, endMinute: 720 }];
  const prof: WeeklyHours[] = [{ weekday: 2, startMinute: 600, endMinute: 780 }];

  it("usa los del profesional si tiene", () => {
    expect(resolveWeeklyHours(prof, biz)).toBe(prof);
  });
  it("cae a los del comercio si el profesional no tiene", () => {
    expect(resolveWeeklyHours([], biz)).toBe(biz);
  });
});
