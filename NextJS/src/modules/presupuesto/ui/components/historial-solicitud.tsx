import { VistaVacia } from "@/shared/ui/components/vista-estados";
import { LineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { hitosDeHistorial } from "@/modules/captacion/ui/historial-hitos";
import type { HitoHistorial } from "../../domain/solicitud";

/** Historial del expediente en línea de tiempo. */
export function HistorialSolicitud({ historial }: { historial: readonly HitoHistorial[] }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h3 className="mb-4 text-lg font-semibold">Historial del expediente</h3>
      {historial.length === 0 ? (
        <VistaVacia titulo="Sin movimientos" descripcion="Aún no hay cambios de estado registrados." />
      ) : (
        <LineaTiempo etiqueta="Historial de estados" hitos={hitosDeHistorial(historial)} />
      )}
    </section>
  );
}
