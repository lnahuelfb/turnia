import { parsePhoneNumberFromString } from "libphonenumber-js";

export class InvalidPhoneError extends Error {
  constructor(public readonly input: unknown) {
    super(`Número de teléfono inválido: ${JSON.stringify(input)}`);
    this.name = "InvalidPhoneError";
  }
}

/**
 * Normaliza un celular argentino a E.164 con el `9` de celular: `+549XXXXXXXXXX`.
 *
 * Acepta las variantes habituales en las que la gente escribe su número:
 *   `+54 9 11 2345-6789` · `011 15 2345 6789` · `11 2345 6789` · `1123456789`
 *   `+5491123456789` · `5491123456789` · `(011) 15-2345-6789`
 *
 * En Argentina el celular se marca con un `9` después del código de país
 * (formato internacional) o con un `15` después de la característica (formato
 * local). WhatsApp usa siempre `+549`. Este helper deja todo en esa forma.
 *
 * Criterio de diseño: un número argentino de 10 dígitos (característica +
 * abonado) sin marca de celular se **asume celular** — es un producto
 * WhatsApp-first y esa es la entrada esperada.
 *
 * MVP: solo Argentina. Un número de otro país lanza `InvalidPhoneError`.
 *
 * @throws {InvalidPhoneError} si no se puede interpretar como celular AR válido.
 */
export function normalizeArPhone(input: string): string {
  if (typeof input !== "string" || input.trim() === "") {
    throw new InvalidPhoneError(input);
  }

  for (const candidate of buildCandidates(input)) {
    const parsed = parsePhoneNumberFromString(candidate, "AR");
    if (parsed?.isValid() && parsed.country === "AR" && parsed.number.startsWith("+549")) {
      return parsed.number;
    }
  }

  throw new InvalidPhoneError(input);
}

/** `true` si el string se puede normalizar a un celular argentino válido. */
export function isValidArPhone(input: string): boolean {
  try {
    normalizeArPhone(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formato para mostrar en pantalla: `+54 9 11 2345-6789`.
 * Espera un E.164 ya normalizado; si no puede, devuelve el input tal cual.
 */
export function formatArPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.formatInternational() ?? e164;
}

/**
 * Variantes a probar, en orden de preferencia:
 *  1. El input tal cual (libphonenumber entiende `011`, `15`, `+54 9`, …).
 *  2. Solo dígitos con `+` si traía código de país.
 *  3. Forzar celular: tomar los 10 dígitos significativos y anteponer `+549`.
 */
function buildCandidates(input: string): string[] {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  const out = new Set<string>();

  out.add(trimmed);

  if (digits.startsWith("54")) {
    out.add(`+${digits}`);
  }

  let nsn = digits;
  if (nsn.startsWith("54")) nsn = nsn.slice(2);
  if (nsn.startsWith("9")) nsn = nsn.slice(1);
  nsn = nsn.replace(/^0/, "");
  // `15` local pegado adelante del abonado, con característica de 2 o 3 dígitos.
  if (nsn.length === 12 && nsn.slice(2, 4) === "15") nsn = nsn.slice(0, 2) + nsn.slice(4);
  else if (nsn.length === 13 && nsn.slice(3, 5) === "15") nsn = nsn.slice(0, 3) + nsn.slice(5);
  if (nsn.length === 10) out.add(`+549${nsn}`);

  return [...out];
}
