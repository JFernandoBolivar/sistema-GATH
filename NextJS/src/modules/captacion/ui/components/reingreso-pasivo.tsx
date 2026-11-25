import { avisoReingresoPasivo } from "../../domain/reingreso-pasivo";

/** Insignia «Reingreso de pasivo» del encabezado del expediente (C-9). */
export function InsigniaReingresoPasivo() {
  return (
    <span data-testid="insignia-reingreso-pasivo" className="rounded-full border border-warning/40 bg-warning-soft px-3 py-0.5 text-xs font-semibold text-warning">
      Reingreso de pasivo
    </span>
  );
}

/** Aviso de lo que ocurrirá al contratar a un jubilado o pensionado, según la opción guardada en su expediente. */
export function AvisoReingresoPasivo({ opcion }: { opcion: string }) {
  return (
    <p role="note" data-testid="aviso-reingreso-pasivo" className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
      <strong className="font-semibold">Es un jubilado o pensionado (trabajador pasivo).</strong> {avisoReingresoPasivo(opcion)}
    </p>
  );
}
