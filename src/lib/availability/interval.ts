/**
 * Aritmética de intervalos semiabiertos `[start, end)` sobre la recta de los
 * milisegundos epoch. Todo acá es puro y sin timezone: se trabaja con números.
 */
export interface Interval {
  /** ms epoch, inclusive. */
  start: number;
  /** ms epoch, exclusivo. */
  end: number;
}

/** `true` si el intervalo tiene duración positiva. */
export function isNonEmpty(i: Interval): boolean {
  return i.end > i.start;
}

/** `true` si `a` y `b` se solapan en algún punto (contacto en el borde no cuenta). */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** `true` si `inner` está contenido en `outer`. */
export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/** Intersección de dos intervalos, o `null` si no se tocan. */
export function intersection(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
}

/**
 * `base` menos `cut`. Devuelve 0, 1 o 2 pedazos (2 si `cut` parte `base` al medio).
 */
export function subtract(base: Interval, cut: Interval): Interval[] {
  if (!overlaps(base, cut)) return [base];
  const pieces: Interval[] = [];
  if (cut.start > base.start) pieces.push({ start: base.start, end: cut.start });
  if (cut.end < base.end) pieces.push({ start: cut.end, end: base.end });
  return pieces;
}

/** `base` menos todos los `cuts` (en cualquier orden, se pueden solapar entre sí). */
export function subtractAll(base: Interval, cuts: Interval[]): Interval[] {
  return cuts.reduce<Interval[]>(
    (acc, cut) => acc.flatMap((piece) => subtract(piece, cut)),
    [base],
  );
}

/**
 * Normaliza una lista: descarta vacíos, ordena por `start` y fusiona los que
 * se solapan o se tocan.
 */
export function mergeOverlapping(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter(isNonEmpty)
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (last && current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}
