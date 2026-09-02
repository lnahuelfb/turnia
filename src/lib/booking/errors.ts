export type BookingErrorCode =
  | "BUSINESS_NOT_FOUND"
  | "SERVICE_NOT_FOUND"
  | "PROFESSIONAL_NOT_FOUND"
  | "INVALID_INPUT"
  | "IN_THE_PAST"
  | "CLIENT_BLOCKED"
  | "QUOTA_EXCEEDED"
  | "SUBSCRIPTION_INACTIVE"
  | "SLOT_UNAVAILABLE"
  | "SLOT_TAKEN";

/** Mapa código → status HTTP para la API. */
export const BOOKING_ERROR_STATUS: Record<BookingErrorCode, number> = {
  BUSINESS_NOT_FOUND: 404,
  SERVICE_NOT_FOUND: 404,
  PROFESSIONAL_NOT_FOUND: 404,
  INVALID_INPUT: 400,
  IN_THE_PAST: 409,
  CLIENT_BLOCKED: 409,
  QUOTA_EXCEEDED: 402,
  SUBSCRIPTION_INACTIVE: 402,
  SLOT_UNAVAILABLE: 409,
  SLOT_TAKEN: 409,
};

export class BookingError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "BookingError";
  }
}
