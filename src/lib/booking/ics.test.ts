import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

const base = {
  uid: "booking-123@turnia",
  start: new Date("2099-01-05T13:00:00.000Z"),
  end: new Date("2099-01-05T13:30:00.000Z"),
  summary: "Corte de pelo — Peluquería Demo",
};

describe("buildIcs", () => {
  it("arma un VCALENDAR válido con CRLF", () => {
    const ics = buildIcs(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("DTSTART:20990105T130000Z");
    expect(ics).toContain("DTEND:20990105T133000Z");
    expect(ics).toContain("UID:booking-123@turnia");
    expect(ics).toContain("SUMMARY:Corte de pelo — Peluquería Demo");
  });

  it("incluye un VALARM con el trigger por defecto (2 h)", () => {
    expect(buildIcs(base)).toContain("TRIGGER:-PT120M");
    expect(buildIcs({ ...base, reminderMinutes: 30 })).toContain("TRIGGER:-PT30M");
  });

  it("escapa comas, punto y coma y saltos de línea", () => {
    const ics = buildIcs({
      ...base,
      description: "Con Juan; traé algo, o no\nGracias",
      location: "Av. Siempre Viva 742, CABA",
    });
    expect(ics).toContain("DESCRIPTION:Con Juan\\; traé algo\\, o no\\nGracias");
    expect(ics).toContain("LOCATION:Av. Siempre Viva 742\\, CABA");
  });

  it("omite DESCRIPTION y LOCATION si no vienen", () => {
    const ics = buildIcs(base);
    expect(ics).not.toContain("DESCRIPTION:Con");
    expect(ics).not.toContain("LOCATION:");
  });
});
