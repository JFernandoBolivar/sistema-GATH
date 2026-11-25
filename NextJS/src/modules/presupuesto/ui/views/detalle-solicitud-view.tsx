"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, FileCheck2, History, Info, ListChecks, Loader2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ItemBarraAcciones } from "@/modules/captacion/domain/barra-acciones";
import { bloqueosVisibles } from "@/modules/captacion/domain/bloqueos";
import { AvisoBloqueos } from "@/modules/captacion/ui/components/aviso-bloqueos";
import { BarraAcciones } from "@/modules/captacion/ui/components/barra-acciones";
import { DialogoMotivo } from "@/modules/captacion/ui/components/dialogo-motivo";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import {
  ESTADO_EDITABLE_PRESUPUESTO,
  motivoDeEntrada,
  pasosGuia,
  type DetalleArea,
  type FiltrosVacantes,
} from "../../domain/solicitud";
import {
  declararConstanciaAction,
  descargarConstanciaPresupuestoAction,
  descargarPuntoCuentaPresupuestoAction,
  liberarReservaAction,
  listarVacantesAction,
  obtenerSolicitudAction,
  reservarPuestoAction,
  transicionarSolicitudAction,
} from "../../infrastructure/actions/presupuesto-actions";
import { EncabezadoSolicitud } from "../components/encabezado-solicitud";
import { GuiaPasos } from "../components/guia-pasos";
import { HistorialSolicitud } from "../components/historial-solicitud";
import { SeccionDisponibilidad } from "../components/seccion-disponibilidad";
import { SeccionPuesto } from "../components/seccion-puesto";
import { PuntoCuentaEmitido } from "../components/seccion-punto-cuenta";

async function cargar(id: string): Promise<DetalleArea> {
  const r = await obtenerSolicitudAction(id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

function aviso(tipo: "exito" | "error", mensaje: string) {
  if (tipo === "exito") toast.success(mensaje);
  else toast.error(mensaje);
}

export function DetalleSolicitudView({ expedienteId }: { expedienteId: string }) {
  const { data: detalle, error, isLoading, mutate } = useSWR(["presupuesto-solicitud", expedienteId], () => cargar(expedienteId), {
    revalidateOnFocus: false,
  });
  const [activa, setActiva] = useState<ItemBarraAcciones | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function cerrarAccion() {
    setActiva(null);
    setErrorAccion(null);
  }

  function ejecutar(item: ItemBarraAcciones, motivo?: string) {
    setErrorAccion(null);
    iniciar(async () => {
      const r = await transicionarSolicitudAction(expedienteId, { destino: item.destino, motivo });
      if (!r.ok) {
        setErrorAccion(r.error);
        return;
      }
      await mutate(r.data, { revalidate: false });
      toast.success(`Listo: «${item.etiqueta}» aplicada.`);
      cerrarAccion();
    });
  }

  /** Aplica el detalle devuelto por el servidor tras reservar, liberar o declarar. */
  async function aplicar(r: Awaited<ReturnType<typeof reservarPuestoAction>>): Promise<string | null> {
    if (!r.ok) return r.error;
    await mutate(r.data, { revalidate: false });
    return null;
  }

  const editable = detalle?.expediente.estado === ESTADO_EDITABLE_PRESUPUESTO;

  return (
    <PageLayout title={detalle ? `Solicitud ${detalle.expediente.numero}` : "Solicitud"} description="Siga los tres pasos: reserve el puesto, declare la disponibilidad y emita el Punto de Cuenta.">
      <div className="mt-4 flex flex-col gap-5 pb-32 sm:pb-0">
        <Link href="/presupuesto/solicitudes" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Volver a la bandeja
        </Link>

        {isLoading ? (
          <VistaCargando mensaje="Cargando la solicitud…" />
        ) : error || !detalle ? (
          <VistaError mensaje={error instanceof Error ? error.message : "No fue posible cargar la solicitud."} onReintentar={() => void mutate()} />
        ) : (
          <>
            <EncabezadoSolicitud detalle={detalle}>
              <div className="flex flex-col gap-3 border-t pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground">¿Qué desea hacer?</h3>
                <BarraAcciones acciones={detalle.acciones} ocupado={pendiente} causaEnAviso onElegir={(item) => { setErrorAccion(null); setActiva(item); }} />
                {errorAccion && activa?.modo === "directa" ? (
                  <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{errorAccion}</p>
                ) : null}
              </div>
            </EncabezadoSolicitud>

            <AvisoBloqueos bloqueos={bloqueosVisibles(detalle.acciones)} />
            <AvisoDeEstado detalle={detalle} />

            <Tabs defaultValue="tramite" className="gap-4">
              <TabsList className="w-full justify-start group-data-[orientation=horizontal]/tabs:h-auto sm:w-fit">
                <TabsTrigger value="tramite" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><ListChecks aria-hidden /> Trámite</TabsTrigger>
                <TabsTrigger value="historial" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><History aria-hidden /> Historial</TabsTrigger>
              </TabsList>
              <TabsContent value="tramite" className="flex flex-col gap-5">
                <GuiaPasos pasos={pasosGuia(detalle)} />
                <SeccionPuesto
                  claveCache={`presupuesto-${expedienteId}`}
                  reserva={detalle.reserva}
                  puedeEditar={editable && detalle.capacidades.puedeReservar}
                  cargarVacantes={(f: FiltrosVacantes) => listarVacantesAction(expedienteId, f)}
                  onReservar={async (puestoId) => {
                    const e = await aplicar(await reservarPuestoAction(expedienteId, puestoId));
                    if (!e) toast.success("Puesto reservado.");
                    return e;
                  }}
                  onLiberar={async () => {
                    const e = await aplicar(await liberarReservaAction(expedienteId));
                    if (!e) toast.success("Reserva liberada.");
                    return e;
                  }}
                />
                <SeccionDisponibilidad
                  constancia={detalle.constancia}
                  puedeDeclarar={editable && detalle.capacidades.puedeDeclararDisponibilidad}
                  onDeclarar={async (form) => {
                    const r = await declararConstanciaAction(expedienteId, form);
                    if (r.ok) await mutate(r.data, { revalidate: false });
                    return r;
                  }}
                  onDescargar={() => descargarConstanciaPresupuestoAction(expedienteId, detalle.expediente.numero)}
                  onAviso={aviso}
                />
                <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="titulo-punto-cuenta">
                  <h3 id="titulo-punto-cuenta" className="flex items-center gap-2 text-lg font-semibold">
                    <FileCheck2 className="size-5 text-primary" aria-hidden /> Punto de Cuenta
                  </h3>
                  {detalle.puntoCuenta ? (
                    <PuntoCuentaEmitido
                      puntoCuenta={detalle.puntoCuenta}
                      onDescargar={() => descargarPuntoCuentaPresupuestoAction(expedienteId, detalle.puntoCuenta?.numero ?? "")}
                      onAviso={aviso}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="sin-punto-cuenta">
                      Aún no se ha emitido. Cuando el puesto esté reservado y la disponibilidad declarada, use «Emitir Punto de Cuenta» para enviarlo a la Dirección General.
                    </p>
                  )}
                </section>
              </TabsContent>
              <TabsContent value="historial"><HistorialSolicitud historial={detalle.historial} /></TabsContent>
            </Tabs>

            {activa?.modo === "motivo" ? (
              <DialogoMotivo
                titulo={activa.etiqueta}
                descripcion="Este motivo quedará en el historial del expediente y lo verá Captación."
                etiquetaConfirmar={activa.etiqueta}
                peligro={activa.variante === "peligro"}
                pendiente={pendiente}
                error={errorAccion}
                onConfirmar={(motivo) => ejecutar(activa, motivo)}
                onCancelar={cerrarAccion}
              />
            ) : null}
            <AlertDialog open={activa?.modo === "directa"} onOpenChange={(a) => (!a && !pendiente ? cerrarAccion() : undefined)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{activa?.etiqueta}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {activa?.destino === "EN_DIRECCION_GENERAL"
                      ? `Se generará el Punto de Cuenta y el expediente ${detalle.expediente.numero} pasará a la Dirección General para su decisión.`
                      : `¿Confirma que desea aplicar esta acción al expediente ${detalle.expediente.numero}?`}
                  </AlertDialogDescription>
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
      </div>
    </PageLayout>
  );
}

/** Texto que explica por qué no hay trámite pendiente cuando el expediente no está EN_PRESUPUESTO. */
function AvisoDeEstado({ detalle }: { detalle: DetalleArea }) {
  const estado = detalle.expediente.estado;
  if (estado === ESTADO_EDITABLE_PRESUPUESTO) return null;
  const motivo = motivoDeEntrada(detalle.historial, estado);
  const texto =
    estado === "DIFERIDO_PRESUPUESTO"
      ? "Esta solicitud está diferida. Cuando se libere la partida, use «Retomar» para continuar el trámite."
      : estado === "EN_CORRECCION_CARGO"
        ? "Esta solicitud se devolvió a Captación para corregir el cargo o la oficina."
        : estado === "EN_DIRECCION_GENERAL"
          ? "El Punto de Cuenta ya fue emitido y espera la decisión de la Dirección General."
          : "Esta solicitud ya no está en Presupuesto: solo puede consultarla.";
  return (
    <div role="note" className="flex items-start gap-3 rounded-xl border border-info/40 bg-info-soft p-4 text-sm" data-testid="aviso-estado">
      <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
      <div className="min-w-0">
        <p className="font-medium">{texto}</p>
        {motivo ? <p className="mt-1 break-words text-muted-foreground">Motivo: {motivo}</p> : null}
      </div>
    </div>
  );
}
