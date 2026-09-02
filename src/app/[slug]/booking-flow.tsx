"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import type {
  PublicBusinessPage,
  PublicService,
} from "@/lib/business/types";
import { formatArs, formatDuration } from "@/lib/format";
import { isValidArPhone, normalizeArPhone } from "@/lib/phone";

const DAYS_AHEAD = 14;

interface Slot {
  start: string;
  professionalIds: string[];
}

type ProChoice = string | "any";

export function BookingFlow({ business }: { business: PublicBusinessPage }) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [proChoice, setProChoice] = useState<ProChoice | null>(null);
  const [dayIso, setDayIso] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);

  const service = business.services.find((s) => s.id === serviceId) ?? null;

  const eligiblePros = useMemo(() => {
    if (!service) return [];
    return business.professionals.filter((p) =>
      service.professionalIds.includes(p.id),
    );
  }, [service, business.professionals]);

  const days = useMemo(() => buildDays(business.timezone), [business.timezone]);

  function selectService(id: string) {
    setServiceId(id);
    setSlot(null);
    setDayIso(null);
    const pros = business.services.find((s) => s.id === id)?.professionalIds ?? [];
    setProChoice(pros.length === 1 ? pros[0] : "any");
  }

  function selectPro(choice: ProChoice) {
    setProChoice(choice);
    setSlot(null);
  }

  function selectDay(iso: string) {
    setDayIso(iso);
    setSlot(null);
  }

  return (
    <div className="mt-6 space-y-8">
      <Section step={1} title="Elegí el servicio">
        <div className="space-y-2">
          {business.services.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              selected={s.id === serviceId}
              onSelect={() => selectService(s.id)}
            />
          ))}
        </div>
      </Section>

      {service && (
        <Section step={2} title="Elegí con quién">
          <div className="flex flex-wrap gap-2">
            {eligiblePros.length > 1 && (
              <Chip selected={proChoice === "any"} onClick={() => selectPro("any")}>
                Cualquiera disponible
              </Chip>
            )}
            {eligiblePros.map((p) => (
              <Chip
                key={p.id}
                selected={proChoice === p.id}
                onClick={() => selectPro(p.id)}
              >
                {p.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {service && proChoice && (
        <Section step={3} title="Elegí el día">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {days.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => selectDay(d.iso)}
                className={`flex min-w-14 shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-sm transition ${
                  d.iso === dayIso
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                }`}
              >
                <span className="text-xs uppercase opacity-70">{d.weekday}</span>
                <span className="text-base font-semibold">{d.dayNum}</span>
                <span className="text-xs opacity-70">{d.month}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {service && proChoice && dayIso && (
        <Section step={4} title="Elegí el horario">
          <SlotPicker
            slug={business.slug}
            timezone={business.timezone}
            serviceId={service.id}
            proChoice={proChoice}
            dayIso={dayIso}
            selectedStart={slot?.start ?? null}
            onSelect={setSlot}
          />
        </Section>
      )}

      {service && slot && (
        <Section step={5} title="Tus datos">
          <BookingForm
            business={business}
            service={service}
            proChoice={proChoice!}
            eligiblePros={eligiblePros}
            slot={slot}
          />
        </Section>
      )}
    </div>
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ServiceCard({
  service,
  selected,
  onSelect,
}: {
  service: PublicService;
  selected: boolean;
  onSelect: () => void;
}) {
  const price = service.showPrice ? formatArs(service.priceArs) : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition ${
        selected
          ? "border-indigo-600 bg-indigo-50"
          : "border-neutral-200 bg-white hover:border-neutral-300"
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium text-neutral-900">{service.name}</p>
        {service.description && (
          <p className="mt-0.5 text-sm text-neutral-500">{service.description}</p>
        )}
        <p className="mt-1 text-xs text-neutral-400">
          {formatDuration(service.durationMin)}
        </p>
      </div>
      {price && (
        <span className="shrink-0 text-sm font-semibold text-neutral-900">{price}</span>
      )}
    </button>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        selected
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

function SlotPicker({
  slug,
  timezone,
  serviceId,
  proChoice,
  dayIso,
  selectedStart,
  onSelect,
}: {
  slug: string;
  timezone: string;
  serviceId: string;
  proChoice: ProChoice;
  dayIso: string;
  selectedStart: string | null;
  onSelect: (slot: Slot) => void;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSlots(null);
    setError(false);

    const dayStart = DateTime.fromISO(dayIso, { zone: timezone }).startOf("day");
    const params = new URLSearchParams({
      servicio: serviceId,
      desde: dayStart.toUTC().toISO()!,
      hasta: dayStart.plus({ days: 1 }).toUTC().toISO()!,
    });
    if (proChoice !== "any") params.set("profesional", proChoice);

    try {
      const res = await fetch(`/api/${slug}/disponibilidad?${params}`, {
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { slots: Slot[] };
      setSlots(data.slots);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(true);
    }
  }, [slug, timezone, serviceId, proChoice, dayIso]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  if (error) {
    return (
      <p className="text-sm text-red-600">
        No se pudo cargar la disponibilidad.{" "}
        <button type="button" onClick={load} className="underline">
          Reintentar
        </button>
      </p>
    );
  }

  if (slots === null) {
    return <p className="text-sm text-neutral-400">Buscando horarios…</p>;
  }

  if (slots.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No hay horarios disponibles ese día. Probá con otra fecha.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((s) => {
        const label = DateTime.fromISO(s.start, { zone: timezone }).toFormat("HH:mm");
        const selected = s.start === selectedStart;
        return (
          <button
            key={s.start}
            type="button"
            onClick={() => onSelect(s)}
            className={`rounded-lg border py-2 text-sm font-medium transition ${
              selected
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-indigo-300"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function BookingForm({
  business,
  service,
  proChoice,
  eligiblePros,
  slot,
}: {
  business: PublicBusinessPage;
  service: PublicService;
  proChoice: ProChoice;
  eligiblePros: { id: string; name: string }[];
  slot: Slot;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [touchedPhone, setTouchedPhone] = useState(false);

  const phoneOk = phone.trim() !== "" && isValidArPhone(phone);
  const canSubmit = name.trim().length >= 2 && phoneOk;

  const when = DateTime.fromISO(slot.start, { zone: business.timezone });
  const proName =
    proChoice === "any"
      ? "Cualquiera disponible"
      : (eligiblePros.find((p) => p.id === proChoice)?.name ?? "—");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-3 text-sm">
        <Row label="Servicio" value={service.name} />
        <Row label="Profesional" value={proName} />
        <Row
          label="Cuándo"
          value={when.toFormat("cccc d 'de' LLLL, HH:mm 'h'", { locale: "es" })}
        />
        {service.showPrice && formatArs(service.priceArs) && (
          <Row label="Precio" value={formatArs(service.priceArs)!} />
        )}
      </div>

      <div className="space-y-3">
        <Field label="Nombre y apellido">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            placeholder="Cómo te anotamos"
          />
        </Field>

        <Field
          label="WhatsApp"
          hint={
            touchedPhone && phone && !phoneOk
              ? "Ingresá un celular argentino válido"
              : "Te mandamos la confirmación acá"
          }
          hintError={touchedPhone && !!phone && !phoneOk}
        >
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouchedPhone(true)}
            autoComplete="tel"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            placeholder="11 2345 6789"
          />
        </Field>

        <Field label="Email (opcional)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            placeholder="Para el comprobante y el recordatorio"
          />
        </Field>
      </div>

      <button
        type="button"
        disabled
        title="La confirmación de reservas todavía no está conectada"
        className="w-full cursor-not-allowed rounded-lg bg-neutral-300 py-2.5 text-sm font-semibold text-white"
      >
        Reservar turno
      </button>
      <p className="text-center text-xs text-neutral-400">
        {canSubmit
          ? "Falta conectar el paso de confirmación (próximo release)."
          : "Completá tu nombre y WhatsApp para continuar."}
      </p>
      {phone && phoneOk && (
        <p className="text-center text-xs text-neutral-400">
          Se guardará como <span className="font-mono">{safeNormalize(phone)}</span>
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-neutral-400">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value}</span>
    </div>
  );
}

function Field({
  label,
  hint,
  hintError,
  children,
}: {
  label: string;
  hint?: string;
  hintError?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {hint && (
        <span
          className={`mt-1 block text-xs ${hintError ? "text-red-600" : "text-neutral-400"}`}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

function safeNormalize(input: string): string {
  try {
    return normalizeArPhone(input);
  } catch {
    return "—";
  }
}

function buildDays(timezone: string) {
  const today = DateTime.now().setZone(timezone).startOf("day");
  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = today.plus({ days: i });
    return {
      iso: d.toISODate()!,
      weekday: i === 0 ? "Hoy" : d.toFormat("ccc", { locale: "es" }),
      dayNum: d.toFormat("d"),
      month: d.toFormat("LLL", { locale: "es" }),
    };
  });
}
