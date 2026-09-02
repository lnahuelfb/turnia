import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas menos:
     * - api/*  (cada route handler maneja su propia auth)
     * - _next/static, _next/image
     * - favicon, manifest, service worker
     * - archivos con extensión (imágenes, etc.)
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
