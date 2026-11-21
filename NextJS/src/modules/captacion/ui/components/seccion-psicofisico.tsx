"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Download, FileText, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITES_TEXTO } from "@/shared/domain/validation/limites-texto";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import type { ResultadoAccion, ResultadoPsicofisico } from "../../domain/expediente";
import { formatearFecha, formatearFechaHora, formatearTamano } from "../../domain/formato";
import { hoyEnVenezuela, validarPsicofisico, type ValoresPsicofisico } from "../../domain/psicofisico";

interface Props {
  psicofisico: ResultadoPsicofisico;
  /** Permiso `postulacion.registrar_psicofisico` y estado que aún lo admite. */
  puedeRegistrar: boolean;
  onRegistrar: (formData: FormData) => Promise<ResultadoAccion<ResultadoPsicofisico>>;
  onDescargarInforme: () => Promise<ResultadoAccion<{ base64: string; nombre: string }>>;
  /** Tras registrar: la vista recarga el detalle (las acciones disponibles cambian). */
  onRegistrado: () => void;
  /** Avisos (toast) sin acoplar el componente a la librería. */
  onAviso: (tipo: "exito" | "error", mensaje: string) => void;
}

const VACIO: ValoresPsicofisico = { resultado: "", fechaAplicacion: "", observaciones: "", informe: null };

export function SeccionPsicofisico({ psicofisico, puedeRegistrar, onRegistrar, onDescargarInforme, onRegistrado, onAviso }: Props) {
  const [v, setV] = useState<ValoresPsicofisico>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [descargando, setDescargando] = useState(false);
  const [claveArchivo, setClaveArchivo] = useState(0);
  const registrado = psicofisico.resultado !== null;

  function guardar() {
    const e = validarPsicofisico(v);
    setErrores(e);
    setErrorServidor(null);
    if (Object.keys(e).length > 0) return;
    const form = new FormData();
    form.set("resultado", v.resultado);
    form.set("fecha_aplicacion", v.fechaAplicacion);
    if (v.observaciones.trim()) form.set("observaciones", v.observaciones.trim());
    if (v.informe) form.set("informe", v.informe);
    iniciar(async () => {
      const r = await onRegistrar(form);
      if (!r.ok) {
        setErrorServidor(r.error);
        return;
      }
      setV(VACIO);
      setClaveArchivo((k) => k + 1);
      onAviso("exito", "Resultado psicofísico registrado.");
      onRegistrado();
    });
  }

  async function descargar() {
    setDescargando(true);
    const r = await onDescargarInforme();
    setDescargando(false);
    if (!r.ok) {
      onAviso("error", r.error);
      return;
    }
    const bytes = Uint8Array.from(atob(r.data.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.data.nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="mb-3 text-lg font-semibold">Resultado registrado</h3>
        {registrado ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {psicofisico.resultado === "APTO" ? (
                <StatusBadge texto="Apto" tono="success" icono={CheckCircle2} />
              ) : (
                <StatusBadge texto="No apto" tono="danger" icono={XCircle} />
              )}
              <span className="text-sm text-muted-foreground">
                Aplicado el {formatearFecha(psicofisico.fechaAplicacion ? `${psicofisico.fechaAplicacion}T12:00:00-04:00` : null)}
              </span>
            </div>
            {psicofisico.sugiereRechazo ? (
              <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                El resultado no es apto: se sugiere rechazar el expediente. La decisión es de Captación.
              </p>
            ) : null}
            {psicofisico.observaciones ? <p className="text-sm">{psicofisico.observaciones}</p> : null}
            <p className="text-xs text-muted-foreground">
              Registrado {psicofisico.registradoEl ? `el ${formatearFechaHora(psicofisico.registradoEl)}` : ""}
              {psicofisico.registradoPor ? ` por C.I. ${psicofisico.registradoPor}` : ""}.
            </p>
            {psicofisico.tieneInforme ? (
              <Button type="button" variant="outline" className="w-full sm:w-fit" onClick={descargar} disabled={descargando}>
                {descargando ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
                Descargar informe PDF {psicofisico.informeTamano ? `(${formatearTamano(psicofisico.informeTamano)})` : ""}
              </Button>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="size-4" aria-hidden /> Sin informe adjunto.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="psicofisico-sin-registro">
            Aún no hay resultado psicofísico.{" "}
            {psicofisico.obligatorio ? "Es obligatorio para abrir el expediente hacia Presupuesto." : "No es obligatorio para abrir hacia Presupuesto."}
          </p>
        )}
      </div>

      {puedeRegistrar ? (
        <form
          className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
          noValidate
        >
          <h3 className="text-lg font-semibold">{registrado ? "Corregir el resultado" : "Registrar el resultado"}</h3>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Resultado *</legend>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ["APTO", "Apto"],
                  ["NO_APTO", "No apto"],
                ] as const
              ).map(([valor, etiqueta]) => (
                <label
                  key={valor}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                >
                  <input
                    type="radio"
                    name="resultado-psicofisico"
                    value={valor}
                    checked={v.resultado === valor}
                    onChange={() => setV((p) => ({ ...p, resultado: valor }))}
                    className="size-4"
                  />
                  {etiqueta}
                </label>
              ))}
            </div>
            {errores.resultado ? <p className="text-sm text-danger">{errores.resultado}</p> : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="psico-fecha">Fecha de aplicación *</Label>
              <Input
                id="psico-fecha"
                type="date"
                max={hoyEnVenezuela()}
                value={v.fechaAplicacion}
                onChange={(e) => setV((p) => ({ ...p, fechaAplicacion: e.target.value }))}
                aria-invalid={Boolean(errores.fechaAplicacion)}
              />
              {errores.fechaAplicacion ? <p className="text-sm text-danger">{errores.fechaAplicacion}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="psico-informe">Informe PDF (opcional, hasta 10 MB)</Label>
              <Input
                key={claveArchivo}
                id="psico-informe"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setV((p) => ({ ...p, informe: e.target.files?.[0] ?? null }))}
                aria-invalid={Boolean(errores.informe)}
                className="pt-2"
              />
              {errores.informe ? <p className="text-sm text-danger">{errores.informe}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="psico-observaciones">Observaciones (opcional)</Label>
            <Textarea
              id="psico-observaciones"
              value={v.observaciones}
              onChange={(e) => setV((p) => ({ ...p, observaciones: e.target.value }))}
              maxLength={LIMITES_TEXTO.observacion.max}
              className="h-24"
            />
          </div>

          {errorServidor ? (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
              {errorServidor}
            </p>
          ) : null}
          <Button type="submit" className="w-full sm:w-fit" disabled={pendiente}>
            {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {registrado ? "Guardar corrección" : "Registrar resultado"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          El resultado ya no se puede modificar en el estado actual del expediente, o su perfil no tiene permiso para registrarlo.
        </p>
      )}
    </div>
  );
}
