"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, FileCheck2, History, Loader2, MapPin, ScrollText, Wallet } from "lucide-react";
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
import { DialogoMotivo } from "@/modules/captacion/ui/components/dialogo-motivo";
import type { DetalleArea } from "@/modules/presupuesto/domain/solicitud";
import { EncabezadoSolicitud } from "@/modules/presupuesto/ui/components/encabezado-solicitud";
import { FichaPuesto } from "@/modules/presupuesto/ui/components/ficha-puesto";
import { HistorialSolicitud } from "@/modules/presupuesto/ui/components/historial-solicitud";
import { ConstanciaDeclarada } from "@/modules/presupuesto/ui/components/seccion-constancia-lectura";
import { PuntoCuentaEmitido } from "@/modules/presupuesto/ui/components/seccion-punto-cuenta";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import { DESTINO_APROBAR } from "../../domain/ingreso";
import {
  decidirIngresoAction,
  descargarConstanciaDireccionAction,
  descargarPuntoCuentaDireccionAction,
  obtenerIngresoAction,
} from "../../infrastructure/actions/direccion-actions";
import { PanelDecision } from "../components/panel-decision";

async function cargar(id: string): Promise<DetalleArea> {
  const r = await obtenerIngresoAction(id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

function aviso(tipo: "exito" | "error", mensaje: string) {
  if (tipo === "exito") toast.success(mensaje);
  else toast.error(mensaje);
}

export function DetalleIngresoView({ expedienteId }: { expedienteId: string }) {
  const { data: detalle, error, isLoading, mutate } = useSWR(["direccion-ingreso", expedienteId], () => cargar(expedienteId), {
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
      const r = await decidirIngresoAction(expedienteId, { destino: item.destino, motivo });
      if (!r.ok) {
        setErrorAccion(r.error);
        return;
      }
      await mutate(r.data, { revalidate: false });
      toast.success(item.destino === DESTINO_APROBAR ? "Ingreso aprobado." : "Ingreso rechazado.");
      cerrarAccion();
    });
  }

  return (
    <PageLayout title={detalle ? `Ingreso ${detalle.expediente.numero}` : "Ingreso"} description="Revise el Punto de Cuenta y decida si aprueba o rechaza el ingreso.">
      <div className="mt-4 flex flex-col gap-5">
        <Link href="/direccion/ingresos" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Volver a la bandeja
        </Link>

        {isLoading ? (
          <VistaCargando mensaje="Cargando el ingreso…" />
        ) : error || !detalle ? (
          <VistaError mensaje={error instanceof Error ? error.message : "No fue posible cargar el ingreso."} onReintentar={() => void mutate()} />
        ) : (
          <>
            <EncabezadoSolicitud detalle={detalle}>
              <div className="flex flex-col gap-3 border-t pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Su decisión</h3>
                <PanelDecision acciones={detalle.acciones} ocupado={pendiente} onElegir={(item) => { setErrorAccion(null); setActiva(item); }} />
                {errorAccion && activa?.modo === "directa" ? (
                  <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{errorAccion}</p>
                ) : null}
              </div>
            </EncabezadoSolicitud>

            <Tabs defaultValue="resumen" className="gap-4">
              <TabsList className="w-full justify-start group-data-[orientation=horizontal]/tabs:h-auto sm:w-fit">
                <TabsTrigger value="resumen" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><ScrollText aria-hidden /> Resumen</TabsTrigger>
                <TabsTrigger value="historial" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><History aria-hidden /> Historial</TabsTrigger>
              </TabsList>
              <TabsContent value="resumen" className="flex flex-col gap-5">
                <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="titulo-pc">
                  <h3 id="titulo-pc" className="flex items-center gap-2 text-lg font-semibold">
                    <FileCheck2 className="size-5 text-primary" aria-hidden /> Punto de Cuenta
                  </h3>
                  {detalle.puntoCuenta ? (
                    <PuntoCuentaEmitido
                      conAbrir
                      puntoCuenta={detalle.puntoCuenta}
                      onDescargar={() => descargarPuntoCuentaDireccionAction(expedienteId, detalle.puntoCuenta?.numero ?? "")}
                      onAviso={aviso}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Este ingreso no tiene Punto de Cuenta emitido.</p>
                  )}
                </section>
                <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="titulo-puesto-dg">
                  <h3 id="titulo-puesto-dg" className="flex items-center gap-2 text-lg font-semibold">
                    <MapPin className="size-5 text-primary" aria-hidden /> Puesto y unidad
                  </h3>
                  {detalle.reserva?.puesto && detalle.reserva.estado === "ACTIVA" ? (
                    <FichaPuesto puesto={detalle.reserva.puesto} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay un puesto reservado: la reserva fue liberada o no existe.</p>
                  )}
                </section>
                <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="titulo-const-dg">
                  <h3 id="titulo-const-dg" className="flex items-center gap-2 text-lg font-semibold">
                    <Wallet className="size-5 text-primary" aria-hidden /> Disponibilidad presupuestaria
                  </h3>
                  {detalle.constancia ? (
                    <ConstanciaDeclarada
                      constancia={detalle.constancia}
                      onDescargar={() => descargarConstanciaDireccionAction(expedienteId, detalle.expediente.numero)}
                      onAviso={aviso}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay constancia registrada.</p>
                  )}
                </section>
              </TabsContent>
              <TabsContent value="historial"><HistorialSolicitud historial={detalle.historial} /></TabsContent>
            </Tabs>

            {activa?.modo === "motivo" ? (
              <DialogoMotivo
                titulo={activa.etiqueta}
                descripcion="Este motivo quedará en el historial y Presupuesto y Captación lo verán."
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
                    {activa?.destino === DESTINO_APROBAR
                      ? `Se firmará el Punto de Cuenta y el ingreso del expediente ${detalle.expediente.numero} quedará aprobado. ¿Desea continuar?`
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
