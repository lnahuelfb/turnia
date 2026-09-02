/**
 * Slugs de comercio para la URL pública (`turnia.app/<slug>`).
 * Formato: minúsculas, `a-z0-9` y guiones, 3–40, sin guiones al borde ni dobles.
 */

/** Segmentos de ruta que no pueden ser un slug de comercio. */
export const RESERVED_SLUGS = new Set([
  "api",
  "app",
  "operador",
  "auth",
  "login",
  "logout",
  "signout",
  "onboarding",
  "cancelar",
  "turnos",
  "admin",
  "dashboard",
  "_next",
  "static",
  "public",
  "assets",
  "img",
  "images",
  "fonts",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "sw.js",
  "www",
  "mail",
  "help",
  "soporte",
  "ayuda",
  "contacto",
  "terminos",
  "privacidad",
  "legal",
  "about",
  "blog",
  "precios",
  "pricing",
  "planes",
  "nuevo",
  "new",
  "signup",
  "registro",
  "settings",
  "config",
]);

export type SlugError = "too_short" | "too_long" | "invalid_chars" | "reserved";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Marcas diacríticas combinantes U+0300–U+036F (tras normalize NFD).
const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/** Convierte texto libre en un candidato a slug (saca acentos, espacios, etc.). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** `null` si el slug es válido, o el motivo del rechazo. */
export function validateSlug(slug: string): SlugError | null {
  if (slug.length < 3) return "too_short";
  if (slug.length > 40) return "too_long";
  if (!SLUG_RE.test(slug)) return "invalid_chars";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}

export const SLUG_ERROR_MESSAGE: Record<SlugError, string> = {
  too_short: "Tiene que tener al menos 3 caracteres",
  too_long: "No puede superar los 40 caracteres",
  invalid_chars: "Solo minúsculas, números y guiones",
  reserved: "Ese nombre está reservado, probá otro",
};
