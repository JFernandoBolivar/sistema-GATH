"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeEstadoCarga } from "./badge-estado-carga";
import { ResumenMovimiento } from "./paso-revision-analisis";
import type {
  CargaMasivaDetalle,
  CargaMasivaResumen,
} from "../domain/entities/carga-masiva";
import { aplicarCargaAction } from "../infrastructure/actions/carga-masiva-actions";

interface PropsPasoConfirmarAplicacion {
  detalle: CargaMasivaDetalle;
  onRetroceder: () => void;
  onFinalizado: () => void;
}

export function PasoConfirmarAplicacion({
  detalle,
  onRetroceder,
  onFinalizado,
}: PropsPasoConfirmarAplicacion) {
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<CargaMasivaResumen | null>(null);

  const filasConfirmacion = useMemo(
    () =>
      detalle.filas.filter(
        (f) =>
          f.estado === "REQUIERE_CONFIRMACION" || f.estado === "POSIBLE_DUPLICADO",
      ),
    [detalle.filas],
  );
  const pendientes = filasConfirmacion.filter((f) => !f.confirmada).length;
  const puedeAplicar = detalle.filas_validas > 0 && pendientes === 0;

  const ejecutarAplicacion = async () => {
    setAplicando(true);
    try {
      const res = await aplicarCargaAction(detalle.id);
      if (res.success && res.data) {
        setResultado(res.data);
        if (res.data.estado === "PENDIENTE_APROBACION") {
          toast.info(
            "Carga enviada a aprobación. Requiere la autorización de otro usuario con el permiso correspondiente.",
          );
        } else {
          toast.success("Carga masiva aplicada exitosamente en el sistema.");
        }
      } else if (res.error && /requiere.*aprobación/i.test(res.error)) {
        toast.info(res.error);
        setResultado({
          ...detalle,
          estado: "PENDIENTE_APROBACION",
        });
      } else {
        toast.error(res.error || "No se pudo aplicar la carga.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al aplicar la carga");
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Database className="size-5 text-primary" />
            Paso 4: Confirmación y Aplicación
          </CardTitle>
          {resultado && <BadgeEstadoCarga estado={resultado.estado} />}
        </div>
        <CardDescription>
          Confirme la persistencia definitiva de los registros validados en las tablas del sistema.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {!resultado ? (
          <>
            {/* Resumen previo */}
            <div className="rounded-xl border p-5 bg-card space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-sm font-medium text-muted-foreground">Archivo de origen:</span>
                <span className="text-sm font-semibold">{detalle.archivo}</span>
              </div>

              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-sm font-medium text-muted-foreground">Población:</span>
                <span className="text-sm font-semibold">
                  {detalle.poblacion === "PASIVOS" ? "Pasivos" : "Activos"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">Filas Válidas a Aplicar</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {detalle.filas_validas}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">Requieren Confirmación</p>
                  <p className={`text-xl font-bold ${pendientes > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {detalle.filas_confirmadas} / {detalle.filas_confirmacion}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">Filas con Error (Omitidas)</p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                    {detalle.filas_error}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">Total Analizadas</p>
                  <p className="text-xl font-bold text-foreground">
                    {detalle.filas_total}
                  </p>
                </div>
              </div>
            </div>

            {filasConfirmacion.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-amber-600" />
                  Movimientos de cambio de condición
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filasConfirmacion.map((fila) => (
                    <div key={fila.id} className="space-y-1">
                      <p className="text-xs font-medium">
                        Fila {fila.numero_fila} — {fila.tipo.replace(/_/g, " ")}
                        <span className={`ml-2 ${fila.confirmada ? "text-emerald-600" : "text-amber-600"}`}>
                          {fila.confirmada ? "Confirmada" : "Pendiente de confirmación"}
                        </span>
                      </p>
                      {fila.movimiento?.tipo ? <ResumenMovimiento movimiento={fila.movimiento} /> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendientes > 0 && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <ShieldCheck className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-0.5">Faltan confirmaciones:</p>
                  <p>
                    Hay {pendientes} fila(s) de cambio de condición sin confirmar. Vuelva al análisis y
                    confirme cada movimiento; sin confirmación esas filas no se aplican.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3.5 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-semibold mb-0.5">Política de aplicación atómica y reversible:</p>
                <p>
                  Las filas válidas serán creadas o actualizadas preservando auditoría y su estado anterior.
                  Los cambios de condición se registran por el flujo de Movimientos y pueden revertirse con la carga.
                  Si el parámetro institucional de doble aprobación está activo, la carga quedará en estado
                  <em> Pendiente de Aprobación</em> para revisión por parte de la jefatura.
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t">
              <Button
                variant="outline"
                onClick={onRetroceder}
                disabled={aplicando}
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="size-4 mr-2" />
                Atrás (Resultados)
              </Button>

              <Button
                onClick={ejecutarAplicacion}
                disabled={aplicando || !puedeAplicar}
                className="w-full sm:w-auto"
              >
                {aplicando ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Aplicando registros...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4 mr-2" />
                    Aplicar {detalle.filas_validas} Registro(s)
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          /* Estado final completado */
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
            <div
              className={`size-16 rounded-full flex items-center justify-center ${
                resultado.estado === "PENDIENTE_APROBACION"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {resultado.estado === "PENDIENTE_APROBACION" ? (
                <Clock className="size-8" />
              ) : (
                <CheckCircle2 className="size-8" />
              )}
            </div>

            <div className="space-y-1 max-w-md">
              <h3 className="text-base font-semibold">
                {resultado.estado === "PENDIENTE_APROBACION"
                  ? "Carga Pendiente de Aprobación"
                  : "¡Carga Masiva Aplicada Exitosamente!"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {resultado.estado === "PENDIENTE_APROBACION"
                  ? "El proceso fue registrado correctamente y está en espera de la autorización correspondiente."
                  : `Se aplicaron las filas válidas del archivo ${resultado.archivo}. Los datos ya están actualizados en el sistema.`}
              </p>
            </div>

            <div className="pt-4 flex items-center gap-3">
              <Button onClick={onFinalizado} className="text-xs">
                Ir al Historial de Cargas
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
