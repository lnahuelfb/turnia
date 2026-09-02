import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service_role: ignora RLS. SOLO en el servidor (webhooks,
 * jobs, operaciones de Storage con permisos elevados). Nunca importar
 * desde código de cliente.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
