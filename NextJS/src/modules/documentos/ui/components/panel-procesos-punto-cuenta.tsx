"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FilePlus2, Loader2, Lock, Save } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ProcesoPlantilla } from "../../domain/entities/plantilla";
import { procesosPuntoCuenta } from "../../domain/lib/procesos-punto-cuenta";
import { useConfiguracionPuntoCuenta } from "../hooks/use-configuracion-punto-cuenta";
import { useRutaDocumentos } from "../hooks/use-ruta-documentos";

/**
 * Panel de procesos del Punto de Cuenta dentro de la lista de plantillas.
 * Cada interruptor decide si ese proceso emite su Punto de Cuenta automáticamente;
 * el contenido del documento se edita y publica en la plantilla del proceso.
 */
export function PanelProcesosPuntoCuenta({ procesos }: { procesos: readonly ProcesoPlantilla[] }) {
  const RUTA_DOCUMENTOS = useRutaDocumentos();
  const filas = useMemo(() => procesosPuntoCuenta(procesos), [procesos]);
  const { config, faltantes, cargando, error: errorCarga, guardar, recargar, actualizarCache } =
    useConfiguracionPuntoCuenta(filas.length > 0);

  // Solo los interruptores que el usuario cambió; el resto se lee de la configuración vigente.
  const [cambios, setCambios] = useState<Record<string, boolean>>({});
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  if (filas.length === 0) return null;

  const activo = (clave: string, siempreActivo: boolean) =>
    siempreActivo || Boolean(cambios[clave] ?? config?.procesos_habilitados[clave]);

  const hayCambios =
    config !== null &&
    filas.some(
      (f) =>
        !f.siempreActivo &&
        Boolean(cambios[f.clave] ?? config.procesos_habilitados[f.clave]) !==
          Boolean(config.procesos_habilitados[f.clave]),
    );

  const apagados = filas.filter((f) => !f.siempreActivo && !activo(f.clave, f.siempreActivo));

  async function confirmarGuardado() {
    if (!config) return;
    setGuardando(true);
    setErrorGuardado(null);
    const completos = { ...config.procesos_habilitados, ...cambios };
    const r = await guardar(completos);
    setGuardando(false);
    setConfirmando(false);
    if (!r.success) {
      setErrorGuardado(r.error);
      toast.error(r.error);
      return;
    }
    setCambios({});
    actualizarCache(r.data);
    toast.success(`Procesos del Punto de Cuenta guardados (versión ${r.data.version}).`);
  }

  return (
    <section aria-labelledby="titulo-procesos-punto-cuenta" className="mt-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 id="titulo-procesos-punto-cuenta" className="text-base font-semibold">
          Procesos del Punto de Cuenta
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Elija qué operaciones administrativas generan su Punto de Cuenta automáticamente. Cada proceso usa su
          plantilla publicada; si falta, el aviso aparece en su fila.
        </p>
      </div>

      {config && !config.generar ? (
        <p role="note" className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>El interruptor general de Puntos de Cuenta está apagado: aunque un proceso esté activo, no se emitirá.</span>
        </p>
      ) : null}

      {cargando ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando los procesos…
        </div>
      ) : errorCarga ? (
        <div role="alert" className="mt-4 flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{errorCarga}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void recargar()}>
            Reintentar
          </Button>
        </div>
      ) : config ? (
        <>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {filas.map((f) => {
              const encendido = activo(f.clave, f.siempreActivo);
              const faltaPlantilla = faltantes.has(f.codigo);
              return (
                <li
                  key={f.clave}
                  data-testid={`proceso-${f.clave}`}
                  className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors ${
                    encendido ? "bg-background" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold break-words">{f.etiqueta}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.descripcion}</p>
                      {f.siempreActivo ? (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Lock className="size-3 shrink-0" aria-hidden /> Siempre activo: forma parte del flujo de ingreso.
                        </p>
                      ) : (
                        <p className={`mt-1 text-xs font-medium ${encendido ? "text-success" : "text-muted-foreground"}`}>
                          {encendido ? "Emitirá Punto de Cuenta" : "Apagado: no emitirá Punto de Cuenta"}
                        </p>
                      )}
                    </div>
                    <Switch
                      id={`proceso-${f.clave}`}
                      checked={encendido}
                      disabled={f.siempreActivo || guardando}
                      onCheckedChange={(v) => setCambios((prev) => ({ ...prev, [f.clave]: v }))}
                      aria-label={`${encendido ? "Desactivar" : "Activar"} ${f.etiqueta}`}
                    />
                  </div>

                  {faltaPlantilla ? (
                    <div
                      role="status"
                      className="flex flex-col gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-2 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:bg-amber-950/30 dark:text-amber-100"
                    >
                      <span className="flex items-start gap-1.5">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        Falta la plantilla publicada: sin ella este proceso no puede emitir su Punto de Cuenta.
                      </span>
                      <Button asChild size="sm" variant="outline" className="h-8 self-start bg-background sm:self-auto">
                        <Link href={`${RUTA_DOCUMENTOS}?crear=1&proceso=${encodeURIComponent(f.codigo)}&grupo=punto_cuenta`}>
                          <FilePlus2 aria-hidden /> Diseñar plantilla
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {hayCambios ? "Hay cambios sin guardar." : `Configuración vigente (versión ${config.version}).`}
              {errorGuardado ? <span className="ml-2 text-destructive">{errorGuardado}</span> : null}
            </p>
            <Button type="button" size="sm" disabled={!hayCambios || guardando} onClick={() => setConfirmando(true)}>
              {guardando ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              Guardar procesos
            </Button>
          </div>
        </>
      ) : null}

      <AlertDialog open={confirmando} onOpenChange={(abierto) => (!abierto && !guardando ? setConfirmando(false) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Guardar los procesos del Punto de Cuenta</AlertDialogTitle>
            <AlertDialogDescription>
              Se guardará una nueva versión de la configuración. Los procesos que queden apagados dejarán de emitir su
              Punto de Cuenta automáticamente; los documentos ya emitidos no cambian.
              {apagados.length > 0 ? (
                <>
                  {" "}
                  Quedarán apagados: <strong>{apagados.map((f) => f.etiqueta).join(", ")}</strong>.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorGuardado ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {errorGuardado}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={guardando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarGuardado();
              }}
            >
              {guardando ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Guardar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
