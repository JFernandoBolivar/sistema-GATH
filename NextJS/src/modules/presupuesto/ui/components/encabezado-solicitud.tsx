import { Briefcase, Building2 } from "lucide-react";
import { nombreCompleto } from "@/modules/captacion/domain/formato";
import { InsigniaEstado } from "@/modules/captacion/ui/components/insignia-estado";
import { cargoPropuesto, oficinaPropuesta, type DetalleArea } from "../../domain/solicitud";

/** Encabezado de la solicitud: número, estado, postulante y el cargo y la oficina propuestos. */
export function EncabezadoSolicitud({ detalle, children }: { detalle: DetalleArea; children?: React.ReactNode }) {
  const { expediente, postulante } = detalle;
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5" aria-label="Resumen de la solicitud">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-muted-foreground" data-testid="numero-expediente">{expediente.numero}</p>
          <h2 className="break-words text-2xl font-bold">{nombreCompleto(postulante)}</h2>
          <p className="font-mono text-sm text-muted-foreground">C.I. {postulante.cedula}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <InsigniaEstado estado={expediente.estado} />
          {expediente.esReingreso ? (
            <span className="rounded-full border border-info/40 bg-info-soft px-3 py-0.5 text-xs font-semibold text-info">Reingreso</span>
          ) : null}
        </div>
      </div>
      <dl className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
        <div className="flex min-w-0 items-start gap-2">
          <Briefcase className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Cargo propuesto</dt>
            <dd className="break-words text-sm font-semibold">{cargoPropuesto(expediente.propuesta)}</dd>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Oficina propuesta</dt>
            <dd className="break-words text-sm font-semibold">{oficinaPropuesta(expediente.propuesta)}</dd>
          </div>
        </div>
      </dl>
      {children}
    </section>
  );
}
