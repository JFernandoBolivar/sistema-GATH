"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, History, Undo2, KeyRound, Loader2, Stethoscope, UserRound } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { LineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import type { ItemBarraAcciones } from "../../domain/barra-acciones";
import type { CredencialEmitida, DatosPropuesta, DetalleExpediente } from "../../domain/expediente";
import { nombreCompleto } from "../../domain/formato";
import { motivoDeEntrada } from "../../domain/motivo-entrada";
import { hitosDeHistorial } from "../historial-hitos";
import { ESTADOS_PSICOFISICO_EDITABLE } from "../../domain/psicofisico";
import {
  descargarInformePsicofisicoAction,
  obtenerExpedienteAction,
  registrarPsicofisicoAction,
  reponerCredencialAction,
  transicionarExpedienteAction,
} from "../../infrastructure/actions/captacion-actions";
import { BarraAcciones } from "../components/barra-acciones";
import { DialogoMotivo } from "../components/dialogo-motivo";
import { DialogoPropuesta } from "../components/dialogo-propuesta";
import { InsigniaEstado } from "../components/insignia-estado";
import { PanelCredencial } from "../components/panel-credencial";
import { SeccionDatos } from "../components/seccion-datos";
import { SeccionPsicofisico } from "../components/seccion-psicofisico";

const PERMISO_PSICOFISICO = "postulacion.registrar_psicofisico";
const PERMISO_CREDENCIAL = "postulacion.crear_postulante";

async function cargar(id: string): Promise<DetalleExpediente> {
  const r = await obtenerExpedienteAction(id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

export function DetalleExpedienteView({ expedienteId }: { expedienteId: string }) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const { data: detalle, error, isLoading, mutate } = useSWR(["captacion-expediente", expedienteId], () => cargar(expedienteId), {
    revalidateOnFocus: false,
  });

  const [activa, setActiva] = useState<ItemBarraAcciones | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [confirmaReposicion, setConfirmaReposicion] = useState(false);
  const [credencial, setCredencial] = useState<CredencialEmitida | null>(null);

  function cerrarAccion() {
    setActiva(null);
    setErrorAccion(null);
  }

  function ejecutar(item: ItemBarraAcciones, motivo?: string, datos?: DatosPropuesta) {
    setErrorAccion(null);
    iniciar(async () => {
      const r = await transicionarExpedienteAction(expedienteId, {
        destino: item.destino,
        motivo,
        datos,
      });
      if (!r.ok) {
        setErrorAccion(r.error);
        return;
      }
      await mutate(r.data, { revalidate: false });
      toast.success(`Listo: «${item.etiqueta}» aplicada.`);
      cerrarAccion();
    });
  }

  function reponer() {
    setConfirmaReposicion(false);
    iniciar(async () => {
      const r = await reponerCredencialAction(expedienteId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setCredencial(r.data);
    });
  }

  const titulo = detalle ? `Expediente ${detalle.expediente.numero}` : "Expediente";

  return (
    <PageLayout title={titulo} description="Revise los datos del postulante y decida el siguiente paso.">
      <div className="mt-4 flex flex-col gap-5">
        <Link href="/captacion/expedientes" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Volver a la bandeja
        </Link>

        {isLoading ? (
          <VistaCargando mensaje="Cargando el expediente…" />
        ) : error || !detalle ? (
          <VistaError mensaje={error instanceof Error ? error.message : "No fue posible cargar el expediente."} onReintentar={() => void mutate()} />
        ) : (
          <>
            <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5" aria-label="Resumen del expediente">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Postulante</p>
                  <h2 className="break-words text-2xl font-bold">{nombreCompleto(detalle.postulante)}</h2>
                  <p className="font-mono text-sm text-muted-foreground">C.I. {detalle.postulante.cedula}</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <InsigniaEstado estado={detalle.expediente.estado} />
                  {detalle.expediente.esReingreso ? (
                    <span className="rounded-full border border-info/40 bg-info-soft px-3 py-0.5 text-xs font-semibold text-info">Reingreso</span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground">¿Qué desea hacer?</h3>
                <BarraAcciones acciones={detalle.acciones} ocupado={pendiente} onElegir={(item) => { setErrorAccion(null); setActiva(item); }} />
                {errorAccion && activa?.modo === "directa" ? (
                  <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{errorAccion}</p>
                ) : null}
                {tienePermiso(permisos, PERMISO_CREDENCIAL) ? (
                  <div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmaReposicion(true)} disabled={pendiente}>
                      {pendiente && !activa ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
                      Reponer credencial
                    </Button>
                  </div>
                ) : null}
              </div>
            </section>

            {detalle.expediente.estado === "EN_CORRECCION_CARGO" ? (
              <div role="note" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm" data-testid="aviso-correccion-cargo">
                <Undo2 className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold">Presupuesto devolvió este expediente para corregir el cargo o la oficina.</p>
                  {motivoDeEntrada(detalle.historial, "EN_CORRECCION_CARGO") ? (
                    <p className="mt-1 break-words">Motivo: {motivoDeEntrada(detalle.historial, "EN_CORRECCION_CARGO")}</p>
                  ) : null}
                  <p className="mt-1 text-muted-foreground">Use «Reabrir hacia Presupuesto» para enviarlo de nuevo con la propuesta corregida.</p>
                </div>
              </div>
            ) : null}

            <Tabs defaultValue="datos" className="gap-4">
              <TabsList className="w-full justify-start group-data-[orientation=horizontal]/tabs:h-auto sm:w-fit">
                <TabsTrigger value="datos" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><UserRound aria-hidden /> Datos</TabsTrigger>
                <TabsTrigger value="psicofisico" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><Stethoscope aria-hidden /> Psicofísico</TabsTrigger>
                <TabsTrigger value="historial" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><History aria-hidden /> Historial</TabsTrigger>
              </TabsList>
              <TabsContent value="datos"><SeccionDatos detalle={detalle} /></TabsContent>
              <TabsContent value="psicofisico">
                <SeccionPsicofisico
                  psicofisico={detalle.psicofisico}
                  puedeRegistrar={tienePermiso(permisos, PERMISO_PSICOFISICO) && ESTADOS_PSICOFISICO_EDITABLE.has(detalle.expediente.estado)}
                  onRegistrar={(form) => registrarPsicofisicoAction(expedienteId, form)}
                  onDescargarInforme={() => descargarInformePsicofisicoAction(expedienteId)}
                  onRegistrado={() => void mutate()}
                  onAviso={(tipo, mensaje) => (tipo === "exito" ? toast.success(mensaje) : toast.error(mensaje))}
                />
              </TabsContent>
              <TabsContent value="historial">
                <section className="rounded-xl border bg-card p-4 sm:p-5">
                  <h3 className="mb-4 text-lg font-semibold">Historial del expediente</h3>
                  {detalle.historial.length === 0 ? (
                    <VistaVacia titulo="Sin movimientos" descripcion="Aún no hay cambios de estado registrados." />
                  ) : (
                    <LineaTiempo etiqueta="Historial de estados" hitos={hitosDeHistorial(detalle.historial)} />
                  )}
                </section>
              </TabsContent>
            </Tabs>

            {activa?.modo === "motivo" ? (
              <DialogoMotivo
                titulo={activa.etiqueta}
                descripcion="Este motivo quedará en el historial del expediente."
                etiquetaConfirmar={activa.etiqueta}
                peligro={activa.variante === "peligro"}
                pendiente={pendiente}
                error={errorAccion}
                onConfirmar={(motivo) => ejecutar(activa, motivo)}
                onCancelar={cerrarAccion}
              />
            ) : null}
            {activa?.modo === "propuesta" ? (
              <DialogoPropuesta
                titulo={activa.etiqueta}
                etiquetaConfirmar={activa.etiqueta}
                inicial={detalle.expediente.propuesta}
                pendiente={pendiente}
                error={errorAccion}
                onConfirmar={(datos) => ejecutar(activa, undefined, datos)}
                onCancelar={cerrarAccion}
              />
            ) : null}
            <AlertDialog open={activa?.modo === "directa"} onOpenChange={(a) => (!a && !pendiente ? cerrarAccion() : undefined)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{activa?.etiqueta}</AlertDialogTitle>
                  <AlertDialogDescription>¿Confirma que desea aplicar esta acción al expediente {detalle.expediente.numero}?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={pendiente}
                    onClick={(e) => {
                      e.preventDefault();
                      if (activa) ejecutar(activa);
                    }}
                  >
                    {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        <AlertDialog open={confirmaReposicion} onOpenChange={setConfirmaReposicion}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reponer la credencial</AlertDialogTitle>
              <AlertDialogDescription>
                Se generará una contraseña temporal nueva. La anterior y las sesiones abiertas del postulante dejarán de funcionar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={reponer}>Reponer credencial</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={credencial !== null} onOpenChange={() => undefined}>
          <DialogContent className="sm:max-w-xl" showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Credencial repuesta</DialogTitle>
              <DialogDescription>Entregue la nueva contraseña temporal al postulante.</DialogDescription>
            </DialogHeader>
            {credencial ? <PanelCredencial credencial={credencial} onEntendido={() => setCredencial(null)} /> : null}
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
