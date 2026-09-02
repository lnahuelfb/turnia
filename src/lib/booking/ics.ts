export interface IcsEvent {
  /** Identificador único y estable del evento. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  /** Minutos antes del turno para el recordatorio nativo (default 120). */
  reminderMinutes?: number;
}

/**
 * Genera un archivo `.ics` (VCALENDAR) para un turno. Instantes en UTC.
 * El calendario del celular dispara su propio recordatorio — costo $0.
 */
export function buildIcs(event: IcsEvent): string {
  const reminder = event.reminderMinutes ?? 120;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Turnia//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(event.start)}`,
    `DTEND:${formatUtc(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  lines.push(
    "BEGIN:VALARM",
    `TRIGGER:-PT${reminder}M`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );
  return lines.join("\r\n") + "\r\n";
}

/** `2099-01-05T13:00:00.000Z` → `20990105T130000Z`. */
function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
