import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, slugify, validateSlug } from "./slug";

describe("slugify", () => {
  it.each([
    ["Peluquería Juan", "peluqueria-juan"],
    ["  Barbería  El Corte  ", "barberia-el-corte"],
    ["Manicura & Spa!!!", "manicura-spa"],
    ["Ñandú Estética", "nandu-estetica"],
    ["--raro--", "raro"],
    ["Consultorio Dr. Pérez", "consultorio-dr-perez"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("recorta a 40 sin dejar guión colgando", () => {
    const out = slugify("a".repeat(38) + " palabra larga");
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("-")).toBe(false);
  });
});

describe("validateSlug", () => {
  it("acepta un slug bien formado", () => {
    expect(validateSlug("peluqueria-juan")).toBeNull();
    expect(validateSlug("abc")).toBeNull();
    expect(validateSlug("barber123")).toBeNull();
  });

  it.each([
    ["ab", "too_short"],
    ["a".repeat(41), "too_long"],
    ["Mayus", "invalid_chars"],
    ["con espacio", "invalid_chars"],
    ["-guion", "invalid_chars"],
    ["doble--guion", "invalid_chars"],
    ["api", "reserved"],
    ["onboarding", "reserved"],
  ])("rechaza %s → %s", (slug, reason) => {
    expect(validateSlug(slug)).toBe(reason);
  });
});

describe("RESERVED_SLUGS", () => {
  it("cubre los segmentos de ruta reales de la app", () => {
    for (const s of ["api", "app", "operador", "auth", "login", "cancelar", "turnos", "onboarding"]) {
      expect(RESERVED_SLUGS.has(s)).toBe(true);
    }
  });
});
