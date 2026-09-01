# Turnia

SaaS de turnos online para comerciantes y profesionales de Argentina. Ver
[`CLAUDE.md`](./CLAUDE.md) para el alcance del producto y las decisiones de diseño.

## Stack

Next.js (App Router) + TypeScript · PostgreSQL/Supabase · Prisma · Tailwind v4 ·
PWA + Web Push · Mercado Pago Suscripciones · Deploy en Vercel.

## Puesta en marcha

Requiere **Node.js 20+** (LTS). En Windows:

```bash
winget install OpenJS.NodeJS.LTS
```

Luego, en la raíz del proyecto:

```bash
npm install
cp .env.example .env.local   # y completar los valores
npm run db:migrate            # crea el schema en la base de Supabase
npm run db:seed               # datos de ejemplo (opcional)
npm run dev
```

App en http://localhost:3000

### Restricción anti-solapamiento (manual)

Prisma no genera restricciones de exclusión. Después de la primera migración,
agregar una migración SQL con:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "bookings" ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "professionalId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  ) WHERE ("status" IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW'));
```

### Claves VAPID para Web Push

```bash
npx web-push generate-vapid-keys
```

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate` + build de producción |
| `npm run db:migrate` | Migración de desarrollo |
| `npm run db:deploy` | Aplica migraciones (producción / CI) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Carga datos de ejemplo |
| `npm run lint` | ESLint |
