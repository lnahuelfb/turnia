export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
        Turnia
      </p>
      <h1 className="text-3xl font-bold sm:text-4xl">
        Turnos online para tu negocio, sin perder tiempo en WhatsApp.
      </h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        Tu página de reservas, un calendario configurable y confirmaciones
        automáticas. Para peluquerías, manicura, consultorios, veterinarias y
        cualquier negocio que trabaje con turnos.
      </p>
      <p className="text-sm text-neutral-500">
        Proyecto en construcción — ver <code>CLAUDE.md</code> para el alcance del MVP.
      </p>
    </main>
  );
}
