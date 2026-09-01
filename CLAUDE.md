# Turnia (nombre provisional)

SaaS web para comerciantes/profesionales independientes en Argentina (muchos en la informalidad) que manejan turnos manualmente por WhatsApp. Turnia les da una página pública de reservas, un calendario configurable y confirmaciones automáticas, para que dejen de perder tiempo coordinando turnos a mano y de perder plata por ausencias.

**Estado**: scaffold inicial. Repo git inicializado, proyecto Next.js (App Router) + Tailwind v4 armado a mano, `schema.prisma` completo con el modelo de datos del MVP. Falta: `npm install` (requiere Node 20+, todavía no instalado en la máquina), primera migración, y toda la lógica de negocio. Este archivo es la fuente de verdad del producto mientras se construye el MVP. Actualizar esta sección a medida que el proyecto avance.

## El problema

En Argentina, la coordinación de turnos (peluquerías, manicuristas, psicólogos, veterinarias, barberías, etc.) se maneja hoy por WhatsApp manual o historias de Instagram con horarios disponibles. Esto le consume tiempo al comerciante, genera errores de superposición de turnos, y no tiene ningún mecanismo real contra las ausencias (el cliente reserva y no aparece, sin costo para él).

## La solución

Una web app donde:
- El comerciante configura una sola vez su franja horaria, servicios (con duración y precio) y profesionales/sillas disponibles.
- Cada comercio tiene una **página pública propia** (ej. `turnia.app/peluqueria-juan`) que comparte por su bio de Instagram, WhatsApp, etc.
- El cliente entra a esa página, ve disponibilidad real en vivo, elige servicio + profesional + horario, deja nombre y WhatsApp, y reserva. Sin crear cuenta.
- El sistema arma la confirmación y el recordatorio sin que el comerciante tenga que escribir un solo mensaje.

## Usuarios

- **Comerciante / profesional** (usuario que paga la suscripción): dueño del negocio. Puede tener 1 o varios profesionales trabajando bajo su cuenta.
- **Profesional / empleado**: una "silla" o agenda dentro de la cuenta del comerciante, con sus propios servicios, duración y horarios. El comerciante los administra; no tienen login propio en el MVP.
- **Cliente final**: la persona que reserva un turno. No tiene cuenta, no tiene login. Se identifica con nombre + número de WhatsApp.

## Alcance: polirrubro desde el día 1

El producto no es "para peluquerías", es genérico para cualquier negocio basado en turnos: peluquería, manicura, barbería, psicólogo/a, veterinaria, podología, depilación, entrenador personal, etc. No debe haber nada hardcodeado a un rubro particular — el comerciante define sus propios servicios, duraciones y nombres libremente. Rubro es, como mucho, un campo informativo/categoría para la página pública y para filtros futuros, nunca una restricción del modelo de datos.

## Modelo de datos (alto nivel)

- **Comercio (Business)**: pertenece a una cuenta/usuario. Tiene nombre, rubro, foto/logo, bio, redes sociales, número de WhatsApp propio, franja horaria general, modo vacaciones, feriados que trabaja/no trabaja, URL pública (slug).
- **Profesional (Professional)**: pertenece a un Comercio. Nombre, foto opcional, horarios propios (puede ser subset de la franja del comercio), lista de Servicios que ofrece (no todos los profesionales hacen todo).
- **Servicio (Service)**: pertenece a un Comercio (y se asocia a los Profesionales que lo hacen). Nombre, duración (minutos), precio, activo/inactivo.
- **Turno (Booking)**: Servicio + Profesional + fecha/hora + datos del cliente (nombre, WhatsApp, email opcional) + estado (confirmado, cancelado-por-cliente, cancelado-por-comercio, completado, ausente/no-show). El turno nace **confirmado** al reservar; no hay estado "pendiente".
- **Cliente (Client)**: identificado por número de WhatsApp dentro del scope de un Comercio (no hay identidad global de cliente en el MVP). Guarda historial de turnos y contador de ausencias **por comercio**.

## Flujo de reserva

1. Cliente entra a la página pública del comercio.
2. Elige servicio → el sistema filtra los profesionales que lo ofrecen.
3. Elige profesional (o "cualquiera disponible").
4. Ve horarios libres calculados en base a: franja horaria del profesional, duración del servicio, turnos ya ocupados, modo vacaciones/feriados.
5. Completa nombre + WhatsApp (+ email opcional), confirma.
6. El turno queda **confirmado al instante** (completar el form y elegir el slot ya es el compromiso — no hay paso de "pendiente" ni auto-liberación). El slot se marca como ocupado en la misma transacción.
7. El comerciante recibe **al toque** una notificación in-app en tiempo real (con sonido/toast si tiene el panel abierto) y una Web Push si no lo tiene. WhatsApp no interviene acá.
8. En la pantalla de confirmación, al cliente se le ofrece (todo opcional, best-effort):
   - Botón `wa.me` con mensaje prearmado hacia el **número del comerciante** (*"Hola, soy [Cliente], reservé [Servicio] con [Profesional] el [Fecha] a las [Hora]"*). Es un extra social, el turno no depende de que lo mande.
   - Descargar **.ics** (agregar a calendario → recordatorio nativo del celular).
   - Si dejó email: recordatorio + comprobante por correo.
9. Cancelación: **link único** en la pantalla de confirmación / email que pega contra la API y libera el slot al instante. No expone al cliente, no depende de WhatsApp. El comerciante recibe notificación in-app + push de que se abrió el horario.
10. Prevención de doble-reserva: el chequeo de disponibilidad y la inserción del turno van en una sola transacción con lock a nivel de base (ver "Consideraciones técnicas clave").

## Notificaciones — estrategia multi-canal de costo ~$0

Decisión explícita: **no se usa WhatsApp Business Cloud API en el MVP**. Motivo: el margen de una suscripción barata (~USD 10) no soporta costo variable por mensaje, y el onboarding con Meta Business (verificación, número dedicado) frena el lanzamiento sin agregar valor proporcional en esta etapa.

El sistema de notificaciones del comerciante es **propio de la app**, no depende de WhatsApp. WhatsApp queda como canal "best-effort" opcional.

### Canales, por orden de prioridad (todos sin costo variable)

1. **Centro de notificaciones in-app + tiempo real (canal principal).**
   - Campanita en el panel con feed de eventos: turno nuevo, turno cancelado por el cliente, no-show automático, cliente bloqueado por ausencias, turno gratis 45/50 y 50/50, cobro rechazado / suscripción vencida.
   - Con **Supabase Realtime**: si el comerciante tiene el panel abierto, el calendario y la campanita se actualizan solos + **sonido + toast visual**, sobre todo en cancelaciones (para que sepa que se liberó un horario). Sin polling.
2. **Web Push (para cuando NO tiene el panel abierto).**
   - App instalable como **PWA** + Service Worker + Web Push con **VAPID self-hosted** (sin proveedor pago). Le llega la notificación al celular con el navegador cerrado.
   - iOS: Safari solo permite Web Push si el usuario agregó la PWA a la pantalla de inicio (iOS 16.4+). En Android/desktop funciona directo. El onboarding muestra el instructivo de "instalar app" y el pedido de permiso de notificaciones.
3. **Email (respaldo para eventos importantes).**
   - Cancelaciones, resumen diario opcional, comprobante al cliente, recordatorio al cliente.
   - Proveedor transaccional con free tier generoso (candidato: **Resend**, ~3.000/mes gratis; alternativa Brevo). Costo ~$0 al volumen del MVP.
4. **`wa.me` (best-effort, ya no es un mecanismo).**
   - Botón en la pantalla de confirmación con mensaje prearmado cliente → comerciante. El turno nunca depende de que el cliente lo mande.

### Recordatorio al cliente
- Archivo **.ics** (recordatorio nativo del SO del celular) + **email** si lo dejó. Ambos $0.
- El envío del email de recordatorio a T-N horas necesita un **job programado** (ver "Consideraciones técnicas clave").

### Arquitectura
Implementar una capa `NotificationService` desacoplada, con `channels` intercambiables (in-app, web-push, email, y a futuro whatsapp-cloud) y un catálogo de `NotificationType` con plantillas por canal. Sumar **WhatsApp Cloud API** real (recordatorio proactivo automático al cliente sin que toque un link) debe ser una feature de un **plan pago superior** en una fase posterior, sin refactor. Si se implementa: número único de la plataforma (no por comerciante) y aprovechar la ventana gratis de 24hs de Meta.

Fuera de scope para el MVP: librerías no oficiales de WhatsApp (Baileys, whatsapp-web.js, etc.) — riesgo de ban de número, inaceptable para un servicio productivo.

## Anti-ausencias (no-shows)

- El bloqueo es **por comercio**, nunca compartido/global entre comercios (evita problemas legales de compartir datos de "clientes problemáticos" entre negocios sin su consentimiento).
- El comerciante puede marcar un turno pasado como "no se presentó" desde su panel.
- Al superar un umbral de ausencias (a definir, candidato inicial: 2 ausencias) el cliente (por su número de WhatsApp) queda bloqueado para reservar en **ese comercio** durante un período configurable (candidato inicial: 30 días).
- Cancelación tardía (dentro de la ventana mínima configurable, candidato: 2 hs antes) cuenta como media ausencia o ausencia según config del comercio — evita que "cancelo 5 minutos antes" sea gratis.
- El recordatorio (.ics + email/push) + la traza del turno en la web ya reducen ausencias respecto al manejo manual por WhatsApp.
- Señas/pagos anticipados para asegurar el turno: **fuera de scope del MVP** (evita meterse con manejo de dinero de terceros, liberación de fondos, disputas). Posible feature de una fase posterior.

## Monetización

- Suscripción mensual al comerciante vía **Mercado Pago Suscripciones** (no Stripe — el foco 100% inicial es Argentina/ARS; no se evalúa expansión fuera de Argentina a menos que el producto funcione acá primero).
- Precio de referencia inicial: **~$15.000 ARS / mes (~USD 10)** para el plan base (1 profesional).
- Planes escalonados por cantidad de profesionales son casi seguro necesarios (no es lo mismo 1 que 5 agendas), pero los tramos exactos y precios **quedan pendientes de definir** con más research antes del lanzamiento.
- **Prueba gratuita basada en uso, no en tiempo**: pool único de **50 turnos gratis por cuenta**, no renovable (se consume una sola vez en la vida de la cuenta, no es mensual). El dashboard del comerciante muestra el contador ("38/50 turnos gratis usados"). Al turno 51 se pide vincular Mercado Pago para seguir usando el sistema.
- Anti-abuso multicuenta para el MVP (barato, sin verificación OTP paga):
  - El número de WhatsApp del comercio es **único por cuenta** (constraint de base de datos, no se puede reusar en otra cuenta).
  - Login vía Google OAuth (email real) reduce cuentas descartables.
  - No se implementa verificación telefónica paga en el MVP — el costo no se justifica para frenar un abuso de bajo impacto en un pool de 50 turnos. Revisar si aparece abuso real en producción.

## Autenticación

- Comerciantes: **magic link + Google OAuth** vía Supabase Auth. Sin contraseñas que gestionar, fricción mínima para el perfil de usuario objetivo.
- Clientes finales: sin cuenta ni login, en ningún momento del MVP.

## Configuración del comercio (panel del comerciante)

- Datos básicos: nombre, foto/logo, bio corta, redes sociales, rubro (informativo).
- Franja horaria de trabajo (general del comercio, y por profesional si difiere).
- Alta/baja de profesionales, cada uno con sus propios servicios y horarios.
- Alta/baja/edición de servicios: nombre, duración, precio, qué profesionales lo hacen.
- Modo vacaciones (cierre temporal, no acepta turnos en ese rango).
- Feriados: marcar cuáles trabaja y cuáles no.
- Carga manual de turnos (para clientes que le escribieron por otro lado y el comerciante quiere bloquear ese horario igual).
- Bloqueos puntuales de agenda (ej. "el martes de 14 a 16 no atiendo") sin ser vacaciones completas.
- Ventana mínima de cancelación y política de cancelación tardía.
- Historial de turnos, marcado de no-show, gestión de clientes bloqueados (ver, desbloquear manualmente).
- Contador de turnos gratis restantes / estado de suscripción.
- Centro de notificaciones (campanita) + preferencias: qué eventos notificar y por qué canal (in-app / push / email).
- Onboarding de primera vez: wizard que arma comercio → profesional(es) → servicios → horarios → link público, y pide permiso de notificaciones / instalar PWA.
- Métricas simples: turnos por semana, ingreso estimado, tasa de ausencias, servicio más pedido. (Candidato a diferenciador de plan pago superior.)

## Idioma y localización

- Español (Argentina) únicamente en el MVP. Sin i18n todavía.
- Zona horaria fija: `America/Argentina/Buenos_Aires`. Sin soporte multi-timezone en el MVP.
- Moneda: ARS únicamente.

## Stack técnico

- **Next.js (App Router) + TypeScript**
- **PostgreSQL vía Supabase** (también Auth, Realtime, y Storage para fotos/logos)
- **Prisma** como ORM (con constraint de exclusión para solapamiento de turnos, ver abajo)
- **Tailwind CSS**
- **PWA**: manifest + Service Worker (instalable, Web Push con VAPID self-hosted)
- **Supabase Realtime** para el panel en vivo (calendario + centro de notificaciones)
- Email transaccional: **Resend** (o Brevo) — free tier
- Jobs programados: **Vercel Cron** o **pg_cron / Supabase Edge Functions** para recordatorios y limpieza
- Deploy en **Vercel**
- Pagos: **Mercado Pago Suscripciones** (preapproval API + webhooks, no Stripe)
- Anti-spam del form público: **Cloudflare Turnstile** (gratis) + rate limit por IP

### Estructura del proyecto

```
src/
  app/            # rutas (App Router). Público: /[slug]; panel: /app/*; operador: /operador/*
  lib/            # prisma.ts, supabase, dominio (motor de disponibilidad, etc.)
  components/
prisma/
  schema.prisma   # modelo de datos (fuente de verdad del schema)
  seed.ts
public/
```

### Convenciones

- Instantes en UTC en la base; convertir a `America/Argentina/Buenos_Aires` solo en el borde (render / parsing de input del usuario).
- Horarios semanales recurrentes: minutos desde medianoche local + `weekday` (0=domingo … 6=sábado).
- Teléfonos en E.164 (`+549…`), normalizados en un único helper al ingresar.
- Nombres de modelos Prisma en inglés singular (`Business`, `Booking`); tablas mapeadas a `snake_case` plural con `@@map`.
- El motor de disponibilidad vive en `src/lib` puro (sin dependencias de Next), con tests.

Convenciones adicionales se documentan acá a medida que aparecen.

## Consideraciones técnicas clave

- **Fecha/hora**: guardar todo en UTC en la base; renderizar en `America/Argentina/Buenos_Aires`. Argentina hoy es UTC-3 fijo, sin horario de verano — no complica, pero no hardcodear el offset.
- **Doble-reserva**: no alcanza un unique constraint (los turnos tienen duración y se solapan). Usar `EXCLUDE USING gist` sobre `(professional_id WITH =, tstzrange(inicio, fin) WITH &&)` en Postgres, o transacción serializable + lock. El chequeo de disponibilidad y el insert van juntos.
- **Motor de disponibilidad**: es la lógica más delicada del producto. Entradas: franja del profesional, duración del servicio, buffer/preparación entre turnos (configurable), turnos ocupados, bloqueos puntuales, vacaciones, feriados. Debe tener cobertura de tests alta y aislada del framework.
- **"Cualquiera disponible"**: al reservar sin elegir profesional, asignar al que tenga el hueco (candidato: menos cargado ese día; definir).
- **Normalización de teléfono**: guardar en E.164 (`+549...`). Los celulares argentinos con el `9` y el `15` son un lío — normalizar en un solo lugar al ingresar.
- **Slugs**: lista de slugs reservados (`app`, `api`, `admin`, `login`, `dashboard`, `_next`, etc.), validación de formato, y si el comercio cambia su slug, dejar redirect del viejo.
- **Recordatorios**: job que corre cada X minutos, busca turnos en la ventana T-N y dispara email/push; marca `reminder_sent_at` para no duplicar.
- **Identidad de cliente**: `(business_id, phone)` es la clave. Mismo teléfono con distinto nombre → mismo cliente, actualizar el nombre al último usado.
- **Cancelación**: el link lleva un token opaco (no el id del turno). Un solo uso lógico (idempotente si ya está cancelado).

## Panel de operador (superadmin)

Mínimo, para vos como dueño de la plataforma (no es parte del producto que ve el comerciante):
- Lista de cuentas, estado de suscripción, turnos consumidos, MRR aproximado.
- Suspender / reactivar una cuenta, extender manualmente el pool gratis, forzar desbloqueo.
- Ver eventos de webhooks de Mercado Pago y su estado.
- Acceso restringido por email allowlist.

## Privacidad y datos personales

- Aplica la Ley 25.326 (Datos Personales, Argentina). Guardamos nombre + teléfono (+ email) de clientes finales que nunca aceptaron términos con nosotros directamente — el responsable es el comercio, Turnia es encargado del tratamiento.
- El link de cancelación sirve también como "gestioná tus datos": permitir que el cliente pida borrado de su historial en ese comercio.
- Política de privacidad y términos por escrito antes de salir a producción.
- Retención: definir por cuánto tiempo se guardan turnos completados / datos de clientes inactivos.

## Fuera de scope del MVP (explícitamente)

- Pagos/señas de clientes para asegurar turnos.
- WhatsApp Business Cloud API / mensajes automáticos proactivos.
- Blocklist de clientes compartida entre comercios.
- Multi-idioma, multi-moneda, multi-timezone.
- Login/cuenta para clientes finales.
- Reprogramación de turno por el cliente (en el MVP: cancelar + volver a reservar).
- App nativa (mobile). Web app responsive / PWA únicamente, mobile-first (la mayoría de los clientes van a reservar desde el celular).

## Decisiones pendientes

- Tramos de precio por cantidad de profesionales (solo se definió el plan base ~USD 10 / 1 profesional).
- Umbral de ausencias y duración exacta del bloqueo por no-show (candidatos: 2 ausencias → 30 días, a validar).
- Ventana mínima de cancelación y peso de la cancelación tardía (candidato: 2 hs → media ausencia).
- Antelación por defecto del recordatorio (candidato: T-2 hs y T-24 hs).
- Regla de asignación para "cualquiera disponible".
- Manejo de suscripción vencida / cobro rechazado: días de gracia antes de bloquear, y qué pasa con la página pública y los turnos ya agendados en ese lapso.
- Nombre y dominio definitivo (hoy: "Turnia", provisorio) — verificar `turnia.app` / `turnia.com.ar`.
- Feriados: precargar calendario oficial argentino por año o carga manual.
