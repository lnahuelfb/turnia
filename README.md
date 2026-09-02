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
cp .env.example .env   # y completar los valores (lo leen Next.js y Prisma)
npm run db:push        # sincroniza el schema con la base de Supabase
npm run db:sql         # aplica los .sql de prisma/sql/ (constraints, etc.)
npm run db:seed        # datos de ejemplo (opcional)
npm run dev
```

App en http://localhost:3000

### Schema: `db push` vs migraciones

Mientras el schema está en movimiento (pre-launch) usamos **`prisma db push`**:
Supabase no permite crear la shadow database que necesita `prisma migrate dev`.
Cuando el modelo se estabilice, se pasa a migraciones versionadas (con una
Postgres local o una base shadow dedicada) + `prisma migrate deploy` en CI.

### Restricción anti-solapamiento

`prisma db push` no crea constraints de exclusión. Vive en
[`prisma/sql/001_booking_no_overlap.sql`](./prisma/sql/001_booking_no_overlap.sql)
y se aplica con `npm run db:sql` (idempotente). Impide que un profesional
tenga dos turnos activos que se pisen.

### Claves VAPID para Web Push

```bash
npx web-push generate-vapid-keys
```

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate` + build de producción |
| `npm run db:push` | Sincroniza el schema con la base (sin migraciones) |
| `npm run db:sql` | Aplica los `.sql` de `prisma/sql/` |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Carga datos de ejemplo |
| `npm run db:migrate` | Migración versionada (aún no en uso, ver arriba) |
| `npm run lint` | ESLint |
