export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center">
      <h1 className="text-sm font-semibold text-neutral-900">{title}</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Esta sección se habilita en el próximo release.
      </p>
    </div>
  );
}
