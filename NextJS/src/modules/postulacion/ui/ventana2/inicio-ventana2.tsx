import { MessageSquareWarning, PartyPopper } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MiExpedienteDTO } from "../../application/dtos/postulacion-dto";
import { calcularAvance, type CatalogosVentana2 } from "../../domain/ventana2";
import { formatearFechaHora } from "../../domain/expediente";
import { CuentaRegresiva } from "../cuenta-regresiva";
import { FormularioVentana2 } from "./formulario-ventana2";

/** Bienvenida de la Ventana 2: felicita, explica qué falta y el plazo, y muestra el formulario por pasos. */
export function InicioVentana2({ vista, catalogos }: { vista: MiExpedienteDTO; catalogos: CatalogosVentana2 }) {
  const { expediente, postulante } = vista;
  const nombre = postulante.nombres.split(" ")[0] || "postulante";
  const avance = calcularAvance(vista.faltantesVentana2);
  const nota = expediente.ultimaObservacion;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="titulo-inicio">
        <div className="flex items-start gap-4">
          <div className="hidden size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 sm:flex dark:bg-emerald-950 dark:text-emerald-300">
            <PartyPopper className="size-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 id="titulo-inicio" className="text-2xl font-bold text-balance">
              ¡Tu ingreso fue aprobado, {nombre}!
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Postulación N.º <span className="font-mono font-medium text-foreground">{expediente.numero}</span>
            </p>
            <p className="mt-3 text-base text-pretty">
              Para terminar tu expediente necesitamos algunos datos: tu grupo familiar, tu vivienda, tu salud, tus tallas y una foto para tu carnet.
              {avance.todoCompleto
                ? " Ya tienes todo completo: revisa y envía."
                : ` Te faltan ${avance.total - avance.completas} de ${avance.total} secciones.`}{" "}
              Puedes guardar tu avance y seguir después, dentro del plazo.
            </p>
          </div>
        </div>
      </section>

      <CuentaRegresiva venceEl={expediente.venceEl} />

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

      <FormularioVentana2
        datosIniciales={vista.datosVentana2}
        faltantesIniciales={vista.faltantesVentana2}
        tieneFotoInicial={vista.tieneFoto}
        catalogosIniciales={catalogos}
      />
    </div>
  );
}
