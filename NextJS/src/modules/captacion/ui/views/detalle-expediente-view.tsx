"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, Camera, ClipboardCheck, FileText, History, Undo2, KeyRound, Loader2, Mail, MapPinned, Stethoscope, UserRound } from "lucide-react";
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
import { DialogoVacantes } from "@/modules/presupuesto/ui/components/dialogo-vacantes";
import { GuiaPasos } from "@/modules/presupuesto/ui/components/guia-pasos";
import type { FiltrosVacantes } from "@/modules/presupuesto/domain/solicitud";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { bloqueosVisibles, type PestanaDetalle } from "../../domain/bloqueos";
import { sinJerga } from "../../domain/jerga";
import { AvisoReingresoPasivo, InsigniaReingresoPasivo } from "../components/reingreso-pasivo";
import type { ItemBarraAcciones } from "../../domain/barra-acciones";
import { describirEstado, type CredencialEmitida, type DatosPropuesta, type DetalleExpediente, type ResultadoAccion } from "../../domain/expediente";
import type { ResultadoContratacion } from "../../domain/contratacion";
import { ENTREGA_CORREO, ENTREGA_PERSONA, entregaEfectiva, type TipoEntrega } from "../../domain/entrega";
import { formatearFechaHora, nombreCompleto } from "../../domain/formato";
import { motivoDeEntrada } from "../../domain/motivo-entrada";
import { esFlujoCorto, muestraPasoAPaso, pasosIngresoCorto } from "../../domain/ingreso-corto";
import { hitosDeHistorial } from "../historial-hitos";
import { ESTADOS_PSICOFISICO_EDITABLE } from "../../domain/psicofisico";
import {
  adjuntarPdfFirmadoCaptacionAction,
  contratarPostulanteAction,
  descargarInformePsicofisicoAction,
  descargarPuntoCuentaCaptacionAction,
  descargarPuntoCuentaFirmadoCaptacionAction,
  enviarEnlaceActivacionAction,
  generarPuntoCuentaCaptacionAction,
  liberarReservaCaptacionAction,
  listarVacantesCaptacionAction,
  obtenerExpedienteAction,
  registrarContactoAction,
  registrarPsicofisicoAction,
  registrarAprobacionCaptacionAction,
  reponerCredencialAction,
  reservarPuestoCaptacionAction,
  transicionarExpedienteAction,
} from "../../infrastructure/actions/captacion-actions";
import { AvisoBloqueos } from "../components/aviso-bloqueos";
import { BannerContacto } from "../components/banner-contacto";
import { BarraAcciones } from "../components/barra-acciones";
import { DialogoContratar, PanelExitoContratacion } from "../components/panel-contratacion";
import { SeccionDocumentosExpediente } from "../components/seccion-documentos";
import { SeccionFotoExpediente } from "../components/seccion-foto-expediente";
import { SeccionVentana2 } from "../components/seccion-ventana2";
import { DialogoAdjuntarFirmado } from "../components/dialogo-adjuntar-firmado";
import { DialogoAprobacion } from "../components/dialogo-aprobacion";
import { DialogoMotivo } from "../components/dialogo-motivo";
import { SeccionIngresoCorto } from "../components/seccion-ingreso-corto";
import { DialogoPropuesta } from "../components/dialogo-propuesta";
import { InsigniaEstado } from "../components/insignia-estado";
import { PanelCredencial } from "../components/panel-credencial";
import { SelectorEntrega } from "../components/selector-entrega";
import { SeccionDatos } from "../components/seccion-datos";
import { SeccionPsicofisico } from "../components/seccion-psicofisico";

const PERMISO_PSICOFISICO = "postulacion.registrar_psicofisico";
const PERMISO_CREDENCIAL = "postulacion.crear_postulante";
/** Reabrir la Ventana 2 (y observar faltantes) emiten un acceso nuevo: ahí se elige cómo entregarlo. */
const DESTINO_REABRE_VENTANA2 = "CONSOLIDANDO";
const ETIQUETA_ENLACE: Record<string, string> = {
  PENDIENTE: "esperando que lo use",
  USADO: "ya usado",
  VENCIDO: "vencido",
  ANULADO: "anulado por uno nuevo",
  BLOQUEADO: "bloqueado por intentos fallidos",
};

async function cargar(id: string): Promise<DetalleExpediente> {
  const r = await obtenerExpedienteAction(id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}


/** Solo con una ventana abierta para el postulante hay credencial que reponer (el backend lo exige igual). */
const ESTADOS_CON_VENTANA_ABIERTA: ReadonlySet<string> = new Set(["PRE_REGISTRADO", "EN_CAPTURA", "EN_CORRECCION_DATOS", "CONSOLIDANDO"]);
function PuntoPendiente() {
  return <span className="ml-1 size-2 rounded-full bg-warning" role="img" aria-label="Pendiente" />;
}

export function DetalleExpedienteView({ expedienteId }: { expedienteId: string }) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const { data: detalle, error, isLoading, mutate } = useSWR(["captacion-expediente", expedienteId], () => cargar(expedienteId), {
    revalidateOnFocus: false,
  });

  const [pestana, setPestana] = useState<PestanaDetalle>("datos");
  const refPestanas = useRef<HTMLDivElement>(null);
  const [activa, setActiva] = useState<ItemBarraAcciones | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [confirmaReposicion, setConfirmaReposicion] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [entrega, setEntrega] = useState<TipoEntrega>(ENTREGA_PERSONA);
  const [credencial, setCredencial] = useState<{ datos: CredencialEmitida; titulo: string; descripcion: string } | null>(null);
  const [errorContacto, setErrorContacto] = useState<string | null>(null);
  const [contratando, setContratando] = useState(false);
  const [errorContratar, setErrorContratar] = useState<string | null>(null);
  const [contratacion, setContratacion] = useState<ResultadoContratacion | null>(null);
  // Flujo sin Presupuesto y/o sin Dirección General (M-5): cada acción abre su panel.
  const [eligiendoPuesto, setEligiendoPuesto] = useState(false);
  const [confirmaLiberar, setConfirmaLiberar] = useState(false);
  const [confirmaGenerar, setConfirmaGenerar] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [adjuntando, setAdjuntando] = useState(false);
  const [errorFlujo, setErrorFlujo] = useState<string | null>(null);
  const ahora = new Date();

  useEffect(() => {
    // En teléfono la pestaña activa debe quedar a la vista aunque se cambie desde un enlace.
    refPestanas.current?.querySelector('[data-state="active"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pestana]);

  function cerrarAccion() {
    setActiva(null);
    setErrorAccion(null);
    setEntrega(ENTREGA_PERSONA);
  }

  function abrirAcceso(paraReenviar: boolean) {
    setReenviando(paraReenviar);
    setEntrega(paraReenviar ? ENTREGA_CORREO : ENTREGA_PERSONA);
    setConfirmaReposicion(true);
  }

  function ejecutar(item: ItemBarraAcciones, motivo?: string, datos?: DatosPropuesta) {
    setErrorAccion(null);
    iniciar(async () => {
      const r = await transicionarExpedienteAction(expedienteId, {
        destino: item.destino,
        motivo,
        datos,
        entrega: item.destino === DESTINO_REABRE_VENTANA2 ? entregaEfectiva(entrega, detalle?.postulante.correo) : undefined,
      });
      if (!r.ok) {
        setErrorAccion(r.error);
        return;
      }
      await mutate(r.data.detalle, { revalidate: false });
      toast.success(`Listo: «${sinJerga(item.etiqueta)}» aplicada.`);
      cerrarAccion();
      // Reabrir la Ventana 2 u observar faltantes emite una contraseña temporal nueva: se muestra UNA vez.
      if (r.data.credencial) {
        const porCorreo = r.data.credencial.enlace !== null;
        setCredencial({
          datos: r.data.credencial,
          titulo: porCorreo ? "Enlace de acceso enviado" : "Credencial de los datos complementarios",
          descripcion: porCorreo
            ? "La contraseña temporal anterior dejó de servir: la persona creará la suya con el enlace."
            : "Entregue esta contraseña temporal al postulante: es la nueva y la anterior dejó de servir.",
        });
      }
    });
  }

  /** Aplica el detalle que devuelve el servidor tras una acción del flujo corto y lleva a la pestaña del resultado. */
  async function aplicarFlujo(r: ResultadoAccion<DetalleExpediente>, exito: string): Promise<string | null> {
    if (!r.ok) return r.error;
    await mutate(r.data, { revalidate: false });
    toast.success(exito);
    setPestana("ingreso");
    return null;
  }

  function cerrarFlujo() {
    setConfirmaLiberar(false);
    setConfirmaGenerar(false);
    setAprobando(false);
    setAdjuntando(false);
    setErrorFlujo(null);
  }

  /** Ejecuta una acción del flujo corto; si falla deja el diálogo abierto con el motivo. */
  function ejecutarFlujo(accion: () => Promise<ResultadoAccion<DetalleExpediente>>, exito: string) {
    setErrorFlujo(null);
    iniciar(async () => {
      const e = await aplicarFlujo(await accion(), exito);
      if (e) setErrorFlujo(e);
      else cerrarFlujo();
    });
  }

  function elegirAccion(item: ItemBarraAcciones) {
    setErrorAccion(null);
    setErrorFlujo(null);
    switch (item.modo) {
      case "contratacion":
        setErrorContratar(null);
        setContratando(true);
        return;
      case "reservar":
        setEligiendoPuesto(true);
        return;
      case "liberar":
        setConfirmaLiberar(true);
        return;
      case "generar_punto_cuenta":
        setConfirmaGenerar(true);
        return;
      case "aprobacion":
        setAprobando(true);
        return;
      case "adjuntar_firmado":
        setAdjuntando(true);
        return;
      default:
        setActiva(item);
    }
  }

  function reponer() {
    setConfirmaReposicion(false);
    const porCorreo = entregaEfectiva(entrega, detalle?.postulante.correo) === ENTREGA_CORREO;
    iniciar(async () => {
      const r = porCorreo ? await enviarEnlaceActivacionAction(expedienteId) : await reponerCredencialAction(expedienteId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setCredencial(
        porCorreo
          ? { datos: r.data, titulo: "Enlace de acceso enviado", descripcion: "El enlace anterior y la contraseña temporal previa dejaron de servir." }
          : { datos: r.data, titulo: "Credencial repuesta", descripcion: "Entregue la nueva contraseña temporal al postulante." },
      );
      if (porCorreo) await mutate();
    });
  }

  function registrarContacto(nota: string) {
    setErrorContacto(null);
    iniciar(async () => {
      const r = await registrarContactoAction(expedienteId, nota);
      if (!r.ok) {
        setErrorContacto(r.error);
        return;
      }
      await mutate(r.data, { revalidate: false });
      toast.success("Contacto registrado.");
    });
  }

  function contratar() {
    setErrorContratar(null);
    iniciar(async () => {
      const r = await contratarPostulanteAction(expedienteId);
      if (!r.ok) {
        setErrorContratar(r.error);
        return;
      }
      setContratando(false);
      setContratacion(r.data);
      await mutate();
    });
  }

  const tieneVentana2 = !!detalle && (detalle.datosVentana2Legible !== null || detalle.foto.tiene || detalle.expediente.ventana === 2);
  const bloqueos = detalle ? bloqueosVisibles(detalle.acciones) : [];
  const pestanasPendientes = new Set(bloqueos.map((b) => b.pestana).filter((p): p is PestanaDetalle => p !== null));
  const conPestanaIngreso =
    !!detalle && esFlujoCorto(detalle.flujo) && (muestraPasoAPaso(detalle.flujo, detalle.expediente.estado) || detalle.reserva !== null || detalle.puntoCuenta !== null);
  const titulo = detalle ? `Expediente ${detalle.expediente.numero}` : "Expediente";

  return (
    <PageLayout title={titulo} description="Revise los datos del postulante y decida el siguiente paso.">
      <div className="mt-4 flex flex-col gap-5 pb-32 sm:pb-0">
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
                  {detalle.postulante.esPasivo ? <InsigniaReingresoPasivo /> : null}
                </div>
              </div>

              {detalle.postulante.esPasivo ? <AvisoReingresoPasivo opcion={detalle.flujo.reingresoPasivo} /> : null}

              <div className="flex flex-col gap-3 border-t pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground">¿Qué desea hacer?</h3>
                <BarraAcciones acciones={detalle.acciones} ocupado={pendiente} causaEnAviso onElegir={elegirAccion} />
                {errorAccion && activa?.modo === "directa" ? (
                  <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{errorAccion}</p>
                ) : null}
                {tienePermiso(permisos, PERMISO_CREDENCIAL) && ESTADOS_CON_VENTANA_ABIERTA.has(detalle.expediente.estado) ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => abrirAcceso(false)} disabled={pendiente}>
                      {pendiente && !activa ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
                      Reponer credencial
                    </Button>
                    {detalle.enlaceActivacion ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => abrirAcceso(true)} disabled={pendiente}>
                        <Mail aria-hidden />
                        Reenviar enlace
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {detalle.enlaceActivacion ? (
                  <p className="text-sm text-muted-foreground" data-testid="estado-enlace">
                    Último enlace de acceso: enviado a <strong className="break-all font-mono text-foreground">{detalle.enlaceActivacion.enviadoA}</strong>
                    {detalle.enlaceActivacion.enviadoEl ? ` el ${formatearFechaHora(detalle.enlaceActivacion.enviadoEl)}` : ""}
                    {detalle.enlaceActivacion.venceEl ? `, vence el ${formatearFechaHora(detalle.enlaceActivacion.venceEl)}` : ""}
                    {" — "}
                    {ETIQUETA_ENLACE[detalle.enlaceActivacion.estado] ?? detalle.enlaceActivacion.estado}
                    {detalle.enlaceActivacion.usadoEl ? ` (${formatearFechaHora(detalle.enlaceActivacion.usadoEl)})` : ""}.
                  </p>
                ) : null}
              </div>
            </section>

            {contratacion ? (
              <PanelExitoContratacion resultado={contratacion} nombre={nombreCompleto(detalle.postulante)} onCerrar={() => setContratacion(null)} />
            ) : null}

            <AvisoBloqueos bloqueos={bloqueos} onIrAPestana={setPestana} />

            <BannerContacto
              contacto={detalle.expediente}
              ahora={ahora}
              pendiente={pendiente}
              error={errorContacto}
              onRegistrar={registrarContacto}
              onCerrarError={() => setErrorContacto(null)}
            />

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

            {muestraPasoAPaso(detalle.flujo, detalle.expediente.estado) ? (
              <section aria-label="Paso a paso del ingreso" className="flex flex-col gap-2" data-testid="paso-a-paso-ingreso">
                <GuiaPasos etiqueta="Pasos del ingreso" pasos={pasosIngresoCorto({ ...detalle, estado: detalle.expediente.estado })} />
              </section>
            ) : null}

            <Tabs value={pestana} onValueChange={(v) => setPestana(v as PestanaDetalle)} className="gap-4">
              <div className="relative">
              <div ref={refPestanas} className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="w-max min-w-full justify-start group-data-[orientation=horizontal]/tabs:h-auto sm:min-w-0">
                <TabsTrigger value="datos" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><UserRound aria-hidden /> Datos</TabsTrigger>
                {tieneVentana2 ? <TabsTrigger value="ventana2" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><ClipboardCheck aria-hidden /> Datos complementarios{pestanasPendientes.has("ventana2") ? <PuntoPendiente /> : null}</TabsTrigger> : null}
                {tieneVentana2 ? <TabsTrigger value="foto" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><Camera aria-hidden /> Foto{pestanasPendientes.has("foto") ? <PuntoPendiente /> : null}</TabsTrigger> : null}
                {tieneVentana2 ? <TabsTrigger value="documentos" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><FileText aria-hidden /> Documentos{pestanasPendientes.has("documentos") ? <PuntoPendiente /> : null}</TabsTrigger> : null}
                {conPestanaIngreso ? <TabsTrigger value="ingreso" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><MapPinned aria-hidden /> Puesto y Punto de Cuenta{pestanasPendientes.has("ingreso") ? <PuntoPendiente /> : null}</TabsTrigger> : null}
                <TabsTrigger value="psicofisico" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><Stethoscope aria-hidden /> Psicofísico{pestanasPendientes.has("psicofisico") ? <PuntoPendiente /> : null}</TabsTrigger>
                <TabsTrigger value="historial" className="min-h-10 flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-3"><History aria-hidden /> Historial</TabsTrigger>
              </TabsList>
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" aria-hidden />
              </div>
              <TabsContent value="datos"><SeccionDatos detalle={detalle} /></TabsContent>
              <TabsContent value="ventana2"><SeccionVentana2 detalle={detalle} /></TabsContent>
              <TabsContent value="foto"><SeccionFotoExpediente foto={detalle.foto} /></TabsContent>
              <TabsContent value="documentos"><SeccionDocumentosExpediente expedienteId={expedienteId} /></TabsContent>
              {conPestanaIngreso ? (
                <TabsContent value="ingreso">
                  <SeccionIngresoCorto
                    detalle={detalle}
                    onDescargarPuntoCuenta={() => descargarPuntoCuentaCaptacionAction(expedienteId, detalle.puntoCuenta?.numero ?? "")}
                    onDescargarFirmado={() => descargarPuntoCuentaFirmadoCaptacionAction(expedienteId, detalle.puntoCuenta?.numero ?? "")}
                    onAviso={(tipo, mensaje) => (tipo === "exito" ? toast.success(mensaje) : toast.error(mensaje))}
                  />
                </TabsContent>
              ) : null}
              <TabsContent value="psicofisico">
                <SeccionPsicofisico
                  psicofisico={detalle.psicofisico}
                  puedeRegistrar={tienePermiso(permisos, PERMISO_PSICOFISICO) && ESTADOS_PSICOFISICO_EDITABLE.has(detalle.expediente.estado)}
                  motivoSinEdicion={
                    !tienePermiso(permisos, PERMISO_PSICOFISICO)
                      ? "Su perfil no tiene permiso para registrar el resultado psicofísico."
                      : `El resultado ya no se puede modificar: el expediente está «${describirEstado(detalle.expediente.estado).etiqueta}».`
                  }
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
              >
                {activa.destino === DESTINO_REABRE_VENTANA2 ? (
                  <SelectorEntrega valor={entrega} onCambio={setEntrega} correo={detalle.postulante.correo} disabled={pendiente} />
                ) : null}
              </DialogoMotivo>
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
            {eligiendoPuesto ? (
              <DialogoVacantes
                claveCache={`captacion-${expedienteId}`}
                sinPropuesta={detalle.expediente.propuesta.cargoId === null && detalle.expediente.propuesta.dependenciaId === null && detalle.expediente.propuesta.direccionGeneralId === null}
                titulo={detalle.reserva?.vigente ? "Cambiar el puesto reservado" : "Reservar el puesto"}
                cargar={(f: FiltrosVacantes) => listarVacantesCaptacionAction(expedienteId, f)}
                onReservar={async (puestoId) => {
                  const e = await aplicarFlujo(await reservarPuestoCaptacionAction(expedienteId, puestoId), "Puesto reservado.");
                  if (!e) setEligiendoPuesto(false);
                  return e;
                }}
                onCerrar={() => setEligiendoPuesto(false)}
              />
            ) : null}
            {aprobando ? (
              <DialogoAprobacion
                numeroPuntoCuenta={detalle.puntoCuenta?.numero}
                pendiente={pendiente}
                error={errorFlujo}
                onConfirmar={(form) => ejecutarFlujo(() => registrarAprobacionCaptacionAction(expedienteId, form), "Aprobación registrada: el expediente quedó aprobado.")}
                onCancelar={cerrarFlujo}
              />
            ) : null}
            {adjuntando ? (
              <DialogoAdjuntarFirmado
                pendiente={pendiente}
                error={errorFlujo}
                onConfirmar={(form) => ejecutarFlujo(() => adjuntarPdfFirmadoCaptacionAction(expedienteId, form), "PDF firmado adjuntado.")}
                onCancelar={cerrarFlujo}
              />
            ) : null}
            <AlertDialog open={confirmaLiberar} onOpenChange={(a) => (!a && !pendiente ? cerrarFlujo() : undefined)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Liberar la reserva</AlertDialogTitle>
                  <AlertDialogDescription>
                    El puesto {detalle.reserva?.puesto?.codigo ?? ""} volverá a estar disponible y deberá reservar otro antes de generar el Punto de Cuenta.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {errorFlujo ? <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{errorFlujo}</p> : null}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={pendiente}
                    onClick={(e) => {
                      e.preventDefault();
                      ejecutarFlujo(() => liberarReservaCaptacionAction(expedienteId), "Reserva liberada.");
                    }}
                  >
                    {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    Liberar puesto
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={confirmaGenerar} onOpenChange={(a) => (!a && !pendiente ? cerrarFlujo() : undefined)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Generar el Punto de Cuenta</AlertDialogTitle>
                  <AlertDialogDescription>
                    {detalle.flujo.requiereDireccionGeneral
                      ? `Se generará el Punto de Cuenta para el puesto ${detalle.reserva?.puesto?.codigo ?? "reservado"} y el expediente ${detalle.expediente.numero} pasará a la Dirección General para su decisión.`
                      : `Se generará el Punto de Cuenta para el puesto ${detalle.reserva?.puesto?.codigo ?? "reservado"}: podrá descargarlo, imprimirlo y firmarlo.`}{" "}
                    Después no se podrá cambiar ni liberar el puesto reservado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {errorFlujo ? <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{errorFlujo}</p> : null}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={pendiente}
                    onClick={(e) => {
                      e.preventDefault();
                      ejecutarFlujo(() => generarPuntoCuentaCaptacionAction(expedienteId), "Punto de Cuenta generado.");
                    }}
                  >
                    {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    Generar Punto de Cuenta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <DialogoContratar
              abierto={contratando}
              pendiente={pendiente}
              error={errorContratar}
              nombre={nombreCompleto(detalle.postulante)}
              onConfirmar={contratar}
              onCancelar={() => setContratando(false)}
            />
            <AlertDialog open={activa?.modo === "directa"} onOpenChange={(a) => (!a && !pendiente ? cerrarAccion() : undefined)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{activa?.etiqueta}</AlertDialogTitle>
                  <AlertDialogDescription>¿Confirma que desea aplicar esta acción al expediente {detalle.expediente.numero}?</AlertDialogDescription>
                </AlertDialogHeader>
                {activa?.destino === DESTINO_REABRE_VENTANA2 ? (
                  <SelectorEntrega valor={entrega} onCambio={setEntrega} correo={detalle.postulante.correo} disabled={pendiente} />
                ) : null}
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
              <AlertDialogTitle>{reenviando ? "Reenviar el enlace de acceso" : "Reponer la credencial"}</AlertDialogTitle>
              <AlertDialogDescription>
                {entregaEfectiva(entrega, detalle?.postulante.correo) === ENTREGA_CORREO
                  ? "Se enviará un enlace nuevo al correo del postulante. El enlace anterior, la contraseña temporal previa y las sesiones abiertas dejarán de funcionar."
                  : "Se generará una contraseña temporal nueva. La anterior, el enlace pendiente y las sesiones abiertas del postulante dejarán de funcionar."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {detalle ? <SelectorEntrega valor={entrega} onCambio={setEntrega} correo={detalle.postulante.correo} /> : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={reponer}>
                {entregaEfectiva(entrega, detalle?.postulante.correo) === ENTREGA_CORREO ? "Enviar enlace" : "Reponer credencial"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={credencial !== null} onOpenChange={() => undefined}>
          <DialogContent className="sm:max-w-xl" showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{credencial?.titulo ?? "Credencial"}</DialogTitle>
              <DialogDescription>{credencial?.descripcion ?? ""}</DialogDescription>
            </DialogHeader>
            {credencial ? <PanelCredencial credencial={credencial.datos} onEntendido={() => setCredencial(null)} /> : null}
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
