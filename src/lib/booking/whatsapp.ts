/**
 * Link `wa.me` (best-effort): el cliente le avisa al comerciante por WhatsApp.
 * El turno NO depende de que lo mande — es solo el rastro social que ya usan.
 */
export function buildWaMeUrl(phoneE164: string, text: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export interface BookingMessageParts {
  clientName: string;
  serviceName: string;
  professionalName: string;
  /** Ya formateado en español, ej. "lunes 5 de enero a las 10:00". */
  whenText: string;
}

/** Mensaje prearmado cliente → comerciante. */
export function buildClientBookingMessage(p: BookingMessageParts): string {
  return `¡Hola! Soy ${p.clientName}, reservé un turno para ${p.serviceName} con ${p.professionalName} el ${p.whenText}.`;
}
