"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileCheck2, Loader2, MapPin, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { FichaPuesto } from "@/modules/presupuesto/ui/components/ficha-puesto";
import { PuntoCuentaEmitido } from "@/modules/presupuesto/ui/components/seccion-punto-cuenta";
import { entregarPdf } from "@/modules/presupuesto/ui/descarga";
import type { DetalleExpediente, ResultadoAccion } from "../../domain/expediente";
import { formatearFechaHora, formatearTamano } from "../../domain/formato";
import { formatearFechaDia, reservaVigente, textoAprobacionFueraDelSistema } from "../../domain/ingreso-corto";

type Descarga = Promise<ResultadoAccion<{ base64: string; nombre: string }>>;

interface Props {
  detalle: Pick<DetalleExpediente, "reserva" | "puntoCuenta" | "flujo">;
  onDescargarPuntoCuenta: () => Descarga;
  onDescargarFirmado: () => Descarga;
  onAviso: (tipo: "exito" | "error", mensaje: string) => void;
}

/**
 * Pestaña «Puesto y Punto de Cuenta» (M-5): el puesto reservado con su vencimiento, el Punto de Cuenta con su
 * descarga y, sin Dirección General, la aprobación firmada fuera del sistema. Solo informa: lo que se puede
 * hacer lo decide la barra de acciones (`acciones[]`).
 */
export function SeccionIngresoCorto({ detalle, onDescargarPuntoCuenta, onDescargarFirmado, onAviso }: Props) {
  const { reserva, puntoCuenta } = detalle;
  const vigente = reservaVigente(reserva);
  const [descargandoFirmado, setDescargandoFirmado] = useState(false);

  async function descargarFirmado() {
    setDescargandoFirmado(true);
    const r = await onDescargarFirmado();
    setDescargandoFirmado(false);
    if (!r.ok) return onAviso("error", r.error);
    entregarPdf(r.data.base64, r.data.nombre);
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="titulo-ingreso-puesto">
        <h3 id="titulo-ingreso-puesto" className="flex items-center gap-2 text-lg font-semibold">
          <MapPin className="size-5 text-primary" aria-hidden /> Puesto reservado
        </h3>
        {(vigente || puntoCuenta) && reserva?.puesto ? (
          <>
            <FichaPuesto puesto={reserva.puesto} />
            <p className="text-sm text-muted-foreground" data-testid="reserva-vence">
              Reservado por {reserva.reservadoPor || "Captación"} el {formatearFechaHora(reserva.reservadoEl)} ·{" "}
              <strong>vence el {formatearFechaHora(reserva.venceEl)}</strong>
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="sin-reserva">
            {reserva && reserva.estado === "ACTIVA"
              ? "La reserva anterior venció. Use «Reservar puesto» para elegir un puesto vacante de nuevo."
              : "Todavía no hay un puesto reservado. Use «Reservar puesto» en las acciones para elegir uno vacante."}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="titulo-ingreso-pc">
        <h3 id="titulo-ingreso-pc" className="flex items-center gap-2 text-lg font-semibold">
          <FileCheck2 className="size-5 text-primary" aria-hidden /> Punto de Cuenta
        </h3>
        {puntoCuenta ? (
          <>
            <PuntoCuentaEmitido puntoCuenta={puntoCuenta} onDescargar={onDescargarPuntoCuenta} onAviso={onAviso} conAbrir etiquetaAbrir="Imprimir PDF" />
            {!puntoCuenta.aprobadoFueraSistema && !detalle.flujo.requiereDireccionGeneral ? (
              <p className="text-sm text-muted-foreground">Imprímalo, fírmelo y use «Registrar la aprobación firmada» con la fecha de la firma.</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="sin-punto-cuenta">
            Aún no se ha generado. Con el puesto reservado, use «Generar el Punto de Cuenta» en las acciones.
          </p>
        )}
      </section>

      {puntoCuenta?.aprobadoFueraSistema ? (
        <section className="flex flex-col gap-3 rounded-xl border border-success/40 bg-success-soft/50 p-4 sm:p-5" aria-labelledby="titulo-ingreso-aprobacion" data-testid="aprobacion-fuera-sistema">
          <h3 id="titulo-ingreso-aprobacion" className="flex items-center gap-2 text-lg font-semibold">
            <PenLine className="size-5 text-success" aria-hidden /> Aprobación
          </h3>
          <StatusBadge texto={textoAprobacionFueraDelSistema(puntoCuenta)} tono="success" icono={CheckCircle2} className="h-auto whitespace-normal" />
          <p className="text-sm text-muted-foreground">
            Registrada por {puntoCuenta.registradoPorNombre || "Captación"} · firma del {formatearFechaDia(puntoCuenta.fechaFirma)}.
          </p>
          {puntoCuenta.tienePdfFirmado ? (
            <Button type="button" variant="outline" className="w-full sm:w-fit" onClick={() => void descargarFirmado()} disabled={descargandoFirmado}>
              {descargandoFirmado ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
              Descargar el PDF firmado{puntoCuenta.pdfFirmadoTamano ? ` (${formatearTamano(puntoCuenta.pdfFirmadoTamano)})` : ""}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="sin-pdf-firmado">
              Aún no se adjuntó el PDF firmado. Use «Adjuntar el Punto de Cuenta firmado» en las acciones.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
