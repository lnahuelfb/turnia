import { describe, expect, it } from "vitest";
import {
  contains,
  type Interval,
  intersection,
  isNonEmpty,
  mergeOverlapping,
  overlaps,
  subtract,
  subtractAll,
} from "./interval";

const iv = (start: number, end: number): Interval => ({ start, end });

describe("overlaps", () => {
  it("detecta solapamiento real", () => {
    expect(overlaps(iv(0, 10), iv(5, 15))).toBe(true);
  });
  it("el contacto en el borde no es solapamiento", () => {
    expect(overlaps(iv(0, 10), iv(10, 20))).toBe(false);
  });
  it("intervalos disjuntos", () => {
    expect(overlaps(iv(0, 10), iv(20, 30))).toBe(false);
  });
});

describe("contains", () => {
  it("contención estricta e igualdad de bordes", () => {
    expect(contains(iv(0, 100), iv(10, 90))).toBe(true);
    expect(contains(iv(0, 100), iv(0, 100))).toBe(true);
  });
  it("no contiene si se desborda", () => {
    expect(contains(iv(0, 100), iv(-1, 50))).toBe(false);
  });
});

describe("intersection", () => {
  it("devuelve la parte común", () => {
    expect(intersection(iv(0, 10), iv(5, 20))).toEqual(iv(5, 10));
  });
  it("null si no se tocan o solo rozan el borde", () => {
    expect(intersection(iv(0, 10), iv(10, 20))).toBeNull();
    expect(intersection(iv(0, 10), iv(50, 60))).toBeNull();
  });
});

describe("subtract", () => {
  it("sin solapamiento devuelve el base intacto", () => {
    expect(subtract(iv(0, 10), iv(20, 30))).toEqual([iv(0, 10)]);
  });
  it("corte al medio parte en dos", () => {
    expect(subtract(iv(0, 100), iv(40, 60))).toEqual([iv(0, 40), iv(60, 100)]);
  });
  it("corte que cubre todo devuelve vacío", () => {
    expect(subtract(iv(10, 20), iv(0, 30))).toEqual([]);
  });
  it("corte por izquierda y por derecha", () => {
    expect(subtract(iv(0, 100), iv(-10, 30))).toEqual([iv(30, 100)]);
    expect(subtract(iv(0, 100), iv(70, 200))).toEqual([iv(0, 70)]);
  });
});

describe("subtractAll", () => {
  it("resta varios cortes, incluso solapados entre sí", () => {
    expect(subtractAll(iv(0, 100), [iv(10, 20), iv(15, 30), iv(80, 90)])).toEqual([
      iv(0, 10),
      iv(30, 80),
      iv(90, 100),
    ]);
  });
  it("sin cortes devuelve el base", () => {
    expect(subtractAll(iv(0, 100), [])).toEqual([iv(0, 100)]);
  });
});

describe("mergeOverlapping", () => {
  it("fusiona solapados y adyacentes, y ordena", () => {
    expect(
      mergeOverlapping([iv(50, 60), iv(0, 10), iv(8, 20), iv(20, 25)]),
    ).toEqual([iv(0, 25), iv(50, 60)]);
  });
  it("descarta intervalos vacíos", () => {
    expect(mergeOverlapping([iv(10, 10), iv(0, 5)])).toEqual([iv(0, 5)]);
  });
  it("lista vacía", () => {
    expect(mergeOverlapping([])).toEqual([]);
  });
});

describe("isNonEmpty", () => {
  it("true solo con duración positiva", () => {
    expect(isNonEmpty(iv(0, 1))).toBe(true);
    expect(isNonEmpty(iv(5, 5))).toBe(false);
    expect(isNonEmpty(iv(5, 4))).toBe(false);
  });
});
