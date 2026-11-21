import { ClipboardList, MessageSquareWarning } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { MiExpedienteDTO } from "../application/dtos/postulacion-dto";
import { describirEstado, formatearFechaHora, puedeEditar } from "../domain/expediente";
import { valoresDesdeExpediente } from "../domain/ventana1";
import { CuentaRegresiva } from "./cuenta-regresiva";
import { FormularioVentana1 } from "./formulario-ventana1";
import { LineaPasos } from "./linea-pasos";

const COLOR_ESTADO = {
  info: "bg-primary/10 text-primary border-primary/20",
  exito: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200",
  atencion: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200",
} as const;

/** Inicio del postulante: estado en lenguaje claro, plazo, nota de Captación y formulario. */
export function InicioPostulacion({ vista }: { vista: MiExpedienteDTO }) {
  const { expediente, postulante } = vista;
  const estado = describirEstado(expediente.estado);
  const editable = puedeEditar(expediente.estado);
  const nota = expediente.ultimaObservacion;
  const nombre = postulante.nombres.split(" ")[0] || "postulante";

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="titulo-inicio">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="titulo-inicio" className="text-2xl font-bold text-balance">
              Hola, {nombre}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Postulación N.º <span className="font-mono font-medium text-foreground">{expediente.numero}</span>
            </p>
          </div>
          <Badge variant="outline" className={`px-3 py-1 text-sm ${COLOR_ESTADO[estado.tono]}`}>
            {estado.etiqueta}
          </Badge>
        </div>
        <p className="mt-3 text-base text-pretty">{estado.explicacion}</p>
        <div className="mt-6">
          <LineaPasos pasoActual={estado.paso} />
        </div>
      </section>

      {editable && <CuentaRegresiva venceEl={expediente.venceEl} />}

      {nota && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <MessageSquareWarning aria-hidden />
          <AlertTitle>Una nota de Captación para ti</AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
            <p className="text-pretty">{nota.motivo}</p>
            {nota.fecha && <p className="mt-1 text-xs opacity-75">{formatearFechaHora(nota.fecha)}</p>}
          </AlertDescription>
        </Alert>
      )}

      {editable ? (
        <FormularioVentana1 inicial={valoresDesdeExpediente(postulante, vista.datosVentana1)} />
      ) : (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
          <ClipboardList className="size-10 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold">No hay nada pendiente por ahora</h2>
          <p className="max-w-md text-pretty text-muted-foreground">
            Tus datos no se pueden modificar en este momento. Captación te contactará si necesita algo más.
          </p>
        </section>
      )}
    </div>
  );
}
