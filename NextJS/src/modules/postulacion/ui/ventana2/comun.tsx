"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ZodIssue, ZodTypeAny } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { campoDeRutaApi, type SeccionVentana2 } from "../../domain/ventana2";

export type ResultadoGuardado = { ok: true } | { ok: false; mensaje: string; errores?: Record<string, string[]> };

/** Lo que cada sección recibe del formulario madre para guardarse. */
export type GuardarSeccion = (cuerpo: Record<string, unknown>) => Promise<ResultadoGuardado>;

export const ASTERISCO = (
  <span className="text-destructive" aria-hidden>
    {" "}
    *
  </span>
);

export function hora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-VE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Caracas" }).format(fecha);
}

/** Marca en el formulario los errores de un `safeParse`; devuelve `true` si había alguno. */
export function marcarIncidencias<T extends FieldValues>(form: UseFormReturn<T>, issues: readonly ZodIssue[]): boolean {
  let primero = true;
  for (const issue of issues) {
    const ruta = issue.path.join(".");
    if (!ruta) continue;
    form.setError(ruta as Path<T>, { type: "validate", message: issue.message }, { shouldFocus: primero });
    primero = false;
  }
  return issues.length > 0;
}

/** Valida con el esquema estricto antes de «Guardar y continuar»: marca los errores y dice si se puede seguir. */
export function validarEstricto<T extends FieldValues>(form: UseFormReturn<T>, esquema: ZodTypeAny): boolean {
  const r = esquema.safeParse(form.getValues());
  if (r.success) return true;
  marcarIncidencias(form, r.error.issues);
  return false;
}

/** Errores del servidor (`{ruta: [mensaje]}`) a los campos de ESTA sección; devuelve `true` si alguno cayó en un campo. */
export function marcarErroresServidor<T extends FieldValues>(
  form: UseFormReturn<T>,
  seccion: SeccionVentana2,
  errores: Record<string, string[]> | undefined,
): boolean {
  let primero = true;
  let alguno = false;
  for (const [ruta, mensajes] of Object.entries(errores ?? {})) {
    const destino = campoDeRutaApi(ruta);
    if (destino.seccion !== seccion) continue;
    form.setError(destino.campo as Path<T>, { type: "server", message: mensajes[0] }, { shouldFocus: primero });
    primero = false;
    alguno = true;
  }
  return alguno;
}

interface PieProps {
  onGuardar: () => void;
  onGuardarYSeguir: () => void;
  onAnterior?: () => void;
  guardando: boolean;
  guardadoA: string | null;
  error: string | null;
  /** Texto del botón principal (por defecto «Guardar y continuar»). */
  etiquetaSeguir?: string;
}

/** Barra inferior fija de cada sección: guardar avance, guardar y seguir, estado del guardado y errores. */
export function PieSeccion({ onGuardar, onGuardarYSeguir, onAnterior, guardando, guardadoA, error, etiquetaSeguir = "Guardar y continuar" }: PieProps) {
  return (
    <>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-xl sm:border sm:shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-5 items-center gap-3 text-sm" role="status" aria-live="polite">
            {onAnterior && (
              <Button type="button" variant="ghost" size="sm" onClick={onAnterior} disabled={guardando}>
                <ArrowLeft aria-hidden /> Anterior
              </Button>
            )}
            {guardadoA && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" aria-hidden />
                Guardado a las {guardadoA}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Button type="button" variant="outline" size="lg" onClick={onGuardar} disabled={guardando}>
              {guardando ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              Guardar avance
            </Button>
            <Button type="button" size="lg" onClick={onGuardarYSeguir} disabled={guardando}>
              {etiquetaSeguir}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function TarjetaSeccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">
        {titulo}
      </h2>
      {descripcion && <p className="mb-4 mt-1 text-sm text-pretty text-muted-foreground">{descripcion}</p>}
      <div className="mt-3 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}
