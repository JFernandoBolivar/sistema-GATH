"use client";

/**
 * Configuración → Proceso de ingreso (M-2). Casillas para decidir qué etapas del ingreso se hacen dentro del
 * sistema (Presupuesto, Dirección General) y si el test psicofísico es obligatorio. Usa la API de parámetros:
 * cada cambio se valida, se confirma antes de guardar y queda en la bitácora.
 */
import { useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowRight, Info, Loader2, RotateCcw, Save, ShieldAlert } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { VistaError } from "@/shared/ui/components/vista-estados";
import type { ParametroDTO } from "../application/dtos/parametro-dto";
import {
  AVISO_EXPEDIENTES_EN_CURSO,
  CASILLAS_PROCESO,
  OPCIONES_REINGRESO_PASIVO,
  cambiosPendientes,
  parametrosDelProceso,
  rutaDelProceso,
} from "../domain/proceso-ingreso";
import { CLAVES_PROCESO_INGRESO } from "../domain/value-objects/claves-parametros";
import { PERMISO_CONFIGURACION } from "../domain/value-objects/permisos-configuracion";
import { actualizarParametroAction, listarParametrosAction } from "../infrastructure/actions/parametros-actions";
import { etiquetaValorParametro, normalizarValorParametro, validarValorParametro } from "./schema/schema-parametros";

async function cargar(): Promise<ParametroDTO[]> {
  const r = await listarParametrosAction();
  if (!Array.isArray(r)) throw new Error((r as { error?: string }).error ?? "No fue posible cargar los parámetros.");
  return r;
}

export function ConfiguracionProcesoIngresoPage() {
  const { data: session } = useSession();
  const puedeEditar = tienePermiso(session?.user?.permisos, PERMISO_CONFIGURACION.editar);
  const { data, error, isLoading, mutate } = useSWR("parametros-proceso-ingreso", cargar, { revalidateOnFocus: false });
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, iniciar] = useTransition();

  const parametros = useMemo(() => parametrosDelProceso(data ?? []), [data]);
  const porClave = useMemo(() => new Map(parametros.map((p) => [p.clave, p])), [parametros]);
  const valorDe = (clave: string) => borrador[clave] ?? porClave.get(clave)?.valor ?? "";
  const cambios = useMemo(() => cambiosPendientes(parametros, borrador), [parametros, borrador]);
  const vigencia = porClave.get(CLAVES_PROCESO_INGRESO.vigenciaReserva);
  const reingreso = porClave.get(CLAVES_PROCESO_INGRESO.reingresoPasivo);
  const valorReingreso = valorDe(CLAVES_PROCESO_INGRESO.reingresoPasivo) || "permitir";

  const sinPresupuesto = valorDe(CLAVES_PROCESO_INGRESO.requierePresupuesto) === "false";
  const sinDireccion = valorDe(CLAVES_PROCESO_INGRESO.requiereDireccionGeneral) === "false";
  const ruta = rutaDelProceso(!sinPresupuesto, !sinDireccion);

  function cambiar(clave: string, valor: string) {
    setBorrador((b) => ({ ...b, [clave]: valor }));
    setErrores((e) => {
      const { [clave]: _quitado, ...resto } = e;
      return resto;
    });
  }

  function descartar() {
    setBorrador({});
    setErrores({});
  }

  function pedirGuardar() {
    const nuevos: Record<string, string> = {};
    for (const c of cambios) {
      const mensaje = validarValorParametro(c.parametro, c.nuevo);
      if (mensaje) nuevos[c.parametro.clave] = mensaje;
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) {
      toast.error("Revise los valores marcados.");
      return;
    }
    setConfirmando(true);
  }

  function guardar() {
    iniciar(async () => {
      const fallidos: string[] = [];
      for (const c of cambios) {
        const r = await actualizarParametroAction(c.parametro.clave, normalizarValorParametro(c.parametro, c.nuevo));
        if (!r || typeof r !== "object" || "error" in r) {
          const err = r as { error?: string; errores?: Record<string, string[]> } | null;
          const mensaje = err?.errores?.valor?.[0] ?? err?.error ?? "No fue posible guardar el parámetro.";
          setErrores((e) => ({ ...e, [c.parametro.clave]: mensaje }));
          fallidos.push(c.parametro.etiqueta);
        }
      }
      setConfirmando(false);
      await mutate();
      if (fallidos.length === 0) {
        setBorrador({});
        toast.success("Proceso de ingreso actualizado. Aplica a los expedientes nuevos.");
      } else {
        // Los que sí se guardaron dejan de ser pendientes (ya coinciden con el valor guardado).
        toast.error(`No se pudo guardar: ${fallidos.join(", ")}.`);
      }
    });
  }

  return (
    <PageLayout
      title="Proceso de ingreso"
      description="Decida qué etapas del ingreso de personal se hacen dentro del sistema y qué exige Captación."
    >
      <div className="mt-4 flex flex-col gap-5 pb-24 sm:pb-0">
        {!puedeEditar ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            No tiene el permiso «{PERMISO_CONFIGURACION.editar}» para editar la configuración.
          </p>
        ) : null}

        <div role="note" data-testid="aviso-expedientes-en-curso" className="flex items-start gap-3 rounded-xl border border-info/40 bg-info-soft p-4 text-sm">
          <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
          <p className="font-medium">{AVISO_EXPEDIENTES_EN_CURSO}</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : error ? (
          <VistaError mensaje={error instanceof Error ? error.message : "No fue posible cargar los parámetros."} onReintentar={() => void mutate()} />
        ) : parametros.length === 0 ? (
          <VistaError mensaje="El servidor no devolvió los parámetros del proceso de ingreso." onReintentar={() => void mutate()} />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Camino del expediente con esta configuración</CardTitle>
                <CardDescription>Las etapas tachadas se gestionan fuera del sistema.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol aria-label="Etapas del ingreso" data-testid="ruta-proceso" className="flex flex-wrap items-center gap-2 text-sm">
                  {ruta.map((etapa, i) => (
                    <li key={etapa.id} data-etapa={etapa.id} data-en-sistema={etapa.enSistema} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 font-semibold",
                          etapa.enSistema ? "border-primary/40 bg-primary/10 text-primary" : "border-dashed text-muted-foreground line-through",
                        )}
                      >
                        {etapa.etiqueta}
                        {!etapa.enSistema ? <span className="sr-only"> (fuera del sistema)</span> : null}
                      </span>
                      {i < ruta.length - 1 ? <ArrowRight className="size-4 text-muted-foreground" aria-hidden /> : null}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Etapas y requisitos</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {CASILLAS_PROCESO.map((casilla) => {
                  const parametro = porClave.get(casilla.clave);
                  if (!parametro) return null;
                  const activa = valorDe(casilla.clave) === "true";
                  const cambiada = borrador[casilla.clave] !== undefined && borrador[casilla.clave] !== parametro.valor;
                  const idDescripcion = `desc-${casilla.clave}`;
                  return (
                    <div key={casilla.clave} data-parametro={casilla.clave} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="min-w-0 max-w-2xl">
                        <Label htmlFor={`param-${casilla.clave}`} className="text-base font-medium">
                          {casilla.titulo}
                          {cambiada ? <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">Sin guardar</span> : null}
                        </Label>
                        <p id={idDescripcion} className="mt-1 text-sm text-muted-foreground">
                          <strong className="font-semibold text-foreground">{activa ? "Activada: " : "Desactivada: "}</strong>
                          {activa ? casilla.siActiva : casilla.siInactiva}
                        </p>
                        {errores[casilla.clave] ? <p role="alert" className="mt-1 text-sm text-destructive">{errores[casilla.clave]}</p> : null}
                      </div>
                      <Switch
                        id={`param-${casilla.clave}`}
                        checked={activa}
                        disabled={!puedeEditar || guardando}
                        onCheckedChange={(marcado) => cambiar(casilla.clave, marcado ? "true" : "false")}
                        aria-describedby={idDescripcion}
                        className="mt-1 shrink-0"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {reingreso ? (
              <Card data-parametro={reingreso.clave}>
                <CardHeader>
                  <CardTitle className="text-base">Reingreso de jubilados y pensionados</CardTitle>
                  <CardDescription>Qué ocurre cuando un trabajador pasivo se postula por Captación.</CardDescription>
                </CardHeader>
                <CardContent>
                  <fieldset className="flex flex-col gap-2" disabled={!puedeEditar || guardando}>
                    <legend className="sr-only">Reingreso de jubilados y pensionados</legend>
                    {OPCIONES_REINGRESO_PASIVO.map((opcion) => {
                      const id = `reingreso-pasivo-${opcion.valor}`;
                      return (
                        <div
                          key={opcion.valor}
                          className="relative flex items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                        >
                          <input
                            id={id}
                            type="radio"
                            name="reingreso-pasivo"
                            value={opcion.valor}
                            checked={valorReingreso === opcion.valor}
                            onChange={() => cambiar(reingreso.clave, opcion.valor)}
                            aria-describedby={`${id}-desc`}
                            className="relative z-10 mt-1 size-4 shrink-0"
                          />
                          <div className="min-w-0 max-w-2xl">
                            <Label htmlFor={id} className="cursor-pointer text-base font-medium">
                              {opcion.titulo}
                              {opcion.valor === "permitir" ? <span className="ml-2 text-xs font-normal text-muted-foreground">(por defecto)</span> : null}
                            </Label>
                            <p id={`${id}-desc`} className="mt-1 text-sm text-muted-foreground">{opcion.explicacion}</p>
                          </div>
                        </div>
                      );
                    })}
                  </fieldset>
                  {borrador[reingreso.clave] !== undefined && borrador[reingreso.clave] !== reingreso.valor ? (
                    <span className="mt-2 inline-block rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">Sin guardar</span>
                  ) : null}
                  {errores[reingreso.clave] ? <p role="alert" className="mt-2 text-sm text-destructive">{errores[reingreso.clave]}</p> : null}
                </CardContent>
              </Card>
            ) : null}

            {vigencia ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reserva del puesto</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Label htmlFor={`param-${vigencia.clave}`} className="text-base font-medium">{vigencia.etiqueta}</Label>
                  <p id={`desc-${vigencia.clave}`} className="max-w-2xl text-sm text-muted-foreground">{vigencia.descripcion}</p>
                  <Input
                    id={`param-${vigencia.clave}`}
                    type="number"
                    inputMode="numeric"
                    min={vigencia.minimo ?? undefined}
                    max={vigencia.maximo ?? undefined}
                    value={valorDe(vigencia.clave)}
                    disabled={!puedeEditar || guardando}
                    aria-invalid={!!errores[vigencia.clave]}
                    aria-describedby={`desc-${vigencia.clave}`}
                    onChange={(e) => cambiar(vigencia.clave, e.target.value)}
                    className="w-full bg-white sm:w-44"
                  />
                  {errores[vigencia.clave] ? <p role="alert" className="text-sm text-destructive">{errores[vigencia.clave]}</p> : null}
                </CardContent>
              </Card>
            ) : null}

            {puedeEditar ? (
              <div
                className={cn(
                  "flex flex-col gap-2 sm:flex-row sm:items-center",
                  "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-40 max-sm:border-t max-sm:bg-background max-sm:p-3 max-sm:shadow-[0_-4px_12px_rgba(0,0,0,0.12)]",
                )}
              >
                <Button type="button" onClick={pedirGuardar} disabled={cambios.length === 0 || guardando} className="w-full sm:w-auto">
                  <Save aria-hidden /> Guardar cambios
                </Button>
                <Button type="button" variant="outline" onClick={descartar} disabled={cambios.length === 0 || guardando} className="w-full sm:w-auto">
                  <RotateCcw aria-hidden /> Descartar
                </Button>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {cambios.length === 0 ? "No hay cambios por guardar." : `${cambios.length} ${cambios.length === 1 ? "cambio" : "cambios"} sin guardar.`}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      <AlertDialog open={confirmando} onOpenChange={(abierto) => (!abierto && !guardando ? setConfirmando(false) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambios en el proceso de ingreso</AlertDialogTitle>
            <AlertDialogDescription>{AVISO_EXPEDIENTES_EN_CURSO}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-col gap-2 text-sm" aria-label="Cambios a guardar">
            {cambios.map((c) => (
              <li key={c.parametro.clave} className="rounded-md border bg-muted/40 p-3">
                <span className="font-semibold">{c.parametro.etiqueta}:</span>{" "}
                {etiquetaValorParametro(c.parametro, c.anterior)} <ArrowRight className="inline size-3.5" aria-label="pasa a" />{" "}
                <strong>{etiquetaValorParametro(c.parametro, c.nuevo)}</strong>
              </li>
            ))}
          </ul>
          {sinPresupuesto || sinDireccion ? (
            <p className="flex items-start gap-2 text-sm text-warning">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Lo que se desactiva pasa a hacerse fuera del sistema: Captación lo reemplaza con el Punto de Cuenta impreso y firmado.
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={guardando}
              onClick={(e) => {
                e.preventDefault();
                guardar();
              }}
            >
              {guardando ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Guardar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
