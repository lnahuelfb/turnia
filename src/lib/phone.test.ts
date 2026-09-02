import { describe, expect, it } from "vitest";
import {
  formatArPhone,
  InvalidPhoneError,
  isValidArPhone,
  normalizeArPhone,
} from "./phone";

describe("normalizeArPhone", () => {
  it("acepta E.164 ya normalizado", () => {
    expect(normalizeArPhone("+5491123456789")).toBe("+5491123456789");
  });

  it.each([
    ["formato internacional con espacios", "+54 9 11 2345-6789", "+5491123456789"],
    ["sin +, con código de país", "5491123456789", "+5491123456789"],
    ["local con 0 y 15", "011 15 2345 6789", "+5491123456789"],
    ["local con 15 sin separadores", "01115234567 89".replace(" ", ""), "+5491123456789"],
    ["con paréntesis y guiones", "(011) 15-2345-6789", "+5491123456789"],
    ["sin 0 ni 15, 10 dígitos", "1123456789", "+5491123456789"],
    ["sin 0 ni 15, con espacios", "11 2345 6789", "+5491123456789"],
    ["característica de 3 dígitos (La Plata) con 15", "0221 15 412 3456", "+5492214123456"],
    ["característica de 3 dígitos sin 15", "2214123456", "+5492214123456"],
  ])("normaliza %s", (_label, input, expected) => {
    expect(normalizeArPhone(input)).toBe(expected);
  });

  it("es idempotente", () => {
    const once = normalizeArPhone("011 15 2345-6789");
    expect(normalizeArPhone(once)).toBe(once);
  });

  it.each([
    ["string vacío", ""],
    ["solo espacios", "   "],
    ["texto", "no soy un teléfono"],
    ["muy corto", "12345"],
    ["número de otro país (Uruguay)", "+59899123456"],
    ["número de otro país (USA)", "+14155552671"],
  ])("rechaza %s", (_label, input) => {
    expect(() => normalizeArPhone(input)).toThrow(InvalidPhoneError);
  });

  it("el error expone el input original", () => {
    try {
      normalizeArPhone("basura");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidPhoneError);
      expect((err as InvalidPhoneError).input).toBe("basura");
    }
  });
});

describe("isValidArPhone", () => {
  it("true para celular válido", () => {
    expect(isValidArPhone("11 2345 6789")).toBe(true);
  });
  it("false para inválido, sin lanzar", () => {
    expect(isValidArPhone("hola")).toBe(false);
  });
});

describe("formatArPhone", () => {
  it("formatea un E.164 a formato internacional legible", () => {
    expect(formatArPhone("+5491123456789")).toBe("+54 9 11 2345 6789");
  });
  it("devuelve el input si no puede parsear", () => {
    expect(formatArPhone("basura")).toBe("basura");
  });
});
