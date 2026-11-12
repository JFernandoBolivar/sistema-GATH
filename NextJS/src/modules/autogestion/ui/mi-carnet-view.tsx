"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  CreditCard,
  Download,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Calendar,
  ShieldCheck,
  FileText,
  Clock,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ContadorCaracteres } from "@/components/contador-caracteres";
import { LIMITES_TEXTO } from "@/shared/validation/limites-texto";
import { CarnetReal } from "./components/carnet-real";
import { PrivacidadCarnetDialog } from "@/modules/carnetizacion/ui/components/privacidad-carnet-dialog";

import {
  getMiExpedienteAction,
  solicitarCarnetAction,
} from "../infrastructure/actions/autogestion-actions";

export function MiCarnetView() {
  const { data, isLoading, mutate } = useSWR("mi-expediente-portal", () =>
    getMiExpedienteAction(),
  );

  const [modalAbierto, setModalAbierto] = useState(false);
  const [privacidadAbierta, setPrivacidadAbierta] = useState(false);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState<number>(1);
  const [observaciones, setObservaciones] = useState("");
  const [solicitando, setSolicitando] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  if (isLoading) {
    return (
      <PageLayout
        title="Mi Credencial Digital"
        description="Identificación institucional oficial de CONATEL"
      >
        <div className="space-y-6">
          <Skeleton className="h-12 w-72" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="h-96 lg:col-span-5 w-full rounded-2xl" />
            <Skeleton className="h-96 lg:col-span-7 w-full rounded-2xl" />
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!data) {
    return (
      <PageLayout
        title="Mi Credencial Digital"
        description="Identificación institucional oficial de CONATEL"
      >
        <Card className="border-border">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="size-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold text-foreground">
              No se pudo cargar la información de su expediente
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Intente nuevamente en unos minutos o comuníquese con Soporte Técnico.
            </p>
            <Button variant="outline" onClick={() => mutate()}>
              <RefreshCw className="size-4 mr-2" /> Reintentar
            </Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  const { empleado, carnets, carnet_activo, motivos_carnet, puede_ver_carnet } = data;

  if (!puede_ver_carnet) {
    return (
      <PageLayout
        title="Mi Credencial Digital"
        description="Identificación institucional oficial de CONATEL"
      >
        <Card className="border-border">
          <CardContent className="py-12 text-center space-y-4">
            <ShieldAlert className="size-12 text-primary mx-auto" />
            <h3 className="text-lg font-semibold text-foreground">
              Módulo no disponible
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              La visualización y solicitud de credencial digital institucional no está habilitada
              para su usuario en este momento según las políticas de acceso del sistema.
            </p>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  const tieneCarnetActivo = Boolean(carnet_activo && carnet_activo.activo);
  const listaCarnets = carnets ?? [];
  const listaMotivos = motivos_carnet ?? [];
  const yaTieneCredencial = listaCarnets.length > 0 || Boolean(carnet_activo);
  const motivosDisponibles = listaMotivos.filter((m: { id: number; nombre: string; descripcion?: string }) => {
    if (!yaTieneCredencial) return true;
    const texto = `${m.nombre} ${m.descripcion ?? ""}`.toUpperCase();
    return !texto.includes("PRIMERA EMISIÓN") && !texto.includes("PRIMERA EMISION");
  });
  const motivoEfectivo = motivosDisponibles.some(
    (m: { id: number }) => m.id === motivoSeleccionado,
  )
    ? motivoSeleccionado
    : (motivosDisponibles[0]?.id ?? 0);

  const handleDescargarPdf = async () => {
    try {
      setDescargandoPdf(true);
      const res = await fetch("/api/v1/autogestion/mi-carnet/pdf/", {
        method: "GET",
        headers: { Accept: "application/pdf" },
      });

      if (!res.ok) {
        if (res.status === 404) {
          toast.error("No posee un carnet activo emitido para descargar.");
        } else {
          toast.error("Error al generar el documento PDF del carnet.");
        }
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `carnet_conatel_${empleado.cedula}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Documento descargado exitosamente.");
    } catch {
      toast.error("Error de comunicación al descargar el carnet.");
    } finally {
      setDescargandoPdf(false);
    }
  };

  const handleEnviarSolicitud = async () => {
    if (!motivoEfectivo) {
      toast.error("No hay un motivo de solicitud disponible para su caso.");
      return;
    }
    try {
      setSolicitando(true);
      const res = await solicitarCarnetAction({
        motivo_id: motivoEfectivo,
        observaciones: observaciones.trim() || undefined,
      });

      if (res.success) {
        toast.success("Solicitud de carnet enviada. Recursos Humanos la revisará.");
        setModalAbierto(false);
        setObservaciones("");
        await mutate();
      } else {
        toast.error(res.message || "Ocurrió un error al procesar la solicitud del carnet.");
      }
    } catch {
      toast.error("Error de comunicación al solicitar el carnet institucional.");
    } finally {
      setSolicitando(false);
    }
  };

  return (
    <PageLayout
      title="Mi Credencial Digital"
      description="Identificación institucional oficial de la Comisión Nacional de Telecomunicaciones (CONATEL)"
    >
      <div className="space-y-6">
        {/* Encabezado con estado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border bg-card">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CreditCard className="size-5 text-primary" aria-hidden="true" />
              <span>{empleado.nombre_completo || `${empleado.nombres} ${empleado.apellidos}`}</span>
            </h2>
            <p className="text-sm text-muted-foreground font-mono">
              Cédula de Identidad: {empleado.cedula}
            </p>
          </div>
          <div>
            {tieneCarnetActivo ? (
              <Badge className="bg-emerald-600 text-white gap-1.5 py-1.5 px-3.5 text-sm font-semibold">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Carnet Activo y Vigente
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground border-border py-1.5 px-3.5 text-sm font-semibold">
                Sin Carnet Activo
              </Badge>
            )}
          </div>
        </div>

        {/* Contenido principal: 2 columnas si está activo, o tarjeta centrada si no */}
        {tieneCarnetActivo ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna izquierda: Vista previa visual */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="overflow-hidden border-border bg-card">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-base font-semibold">Credencial Institucional</CardTitle>
                  <CardDescription className="text-xs">
                    Representación gráfica de su carnet oficial
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex flex-col items-center">
                  <div className="w-full max-w-xs transition-transform duration-300 hover:scale-[1.02]">
                    <CarnetReal
                      cedula={empleado.cedula}
                      alt={`Carnet institucional de ${empleado.nombre_completo || `${empleado.nombres} ${empleado.apellidos}`}`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-4 text-center">
                    <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                    Documento oficial avalado por CONATEL
                  </p>
                </CardContent>
              </Card>

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <Button
                  onClick={handleDescargarPdf}
                  disabled={descargandoPdf}
                  className="flex-1 h-11 text-sm font-semibold gap-2"
                >
                  {descargandoPdf ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Descargar Carnet PDF
                </Button>
                <Button
                  onClick={() => setModalAbierto(true)}
                  variant="outline"
                  className="h-11 text-sm font-medium gap-2"
                >
                  <PlusCircle className="size-4" />
                  Solicitar reposición
                </Button>
                <Button
                  onClick={() => setPrivacidadAbierta(true)}
                  variant="outline"
                  className="h-11 text-sm font-medium gap-2"
                >
                  <ShieldCheck className="size-4" />
                  Privacidad del QR
                </Button>
              </div>
            </div>

            {/* Columna derecha: Detalles técnicos y QR */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="border-border bg-card">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" aria-hidden="true" />
                    Detalles de la Credencial
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-lg border bg-muted/40 space-y-1">
                      <span className="text-xs font-medium text-muted-foreground block">
                        Motivo de Emisión
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {carnet_activo?.motivo_nombre || "PRIMERA EMISIÓN"}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-lg border bg-muted/40 space-y-1">
                      <span className="text-xs font-medium text-muted-foreground block">
                        Fecha de Expedición
                      </span>
                      <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        {carnet_activo?.fecha_emision
                          ? new Date(carnet_activo.fecha_emision).toLocaleDateString("es-VE", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })
                          : "Fecha registrada"}
                      </span>
                    </div>
                  </div>

                  {/* QR de verificación oficial */}
                  {carnet_activo?.security_hash && (
                    <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border bg-muted/30 p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/v1/carnetizacion/public/qr/${carnet_activo.security_hash}/imagen/`}
                        alt="Código QR de verificación del carnet"
                        className="size-32 shrink-0 rounded-lg border bg-white p-2 shadow-xs"
                      />
                      <div className="space-y-1.5 text-center sm:text-left">
                        <p className="text-sm font-semibold text-foreground">
                          Código QR de Validación
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Este código permite verificar la vigencia de su credencial institucional al ser
                          escaneado por el personal de seguridad y control de acceso de CONATEL.
                        </p>
                      </div>
                    </div>
                  )}

                  {carnet_activo?.observaciones && (
                    <p className="text-xs text-muted-foreground italic">
                      Nota: {carnet_activo.observaciones}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Información sobre modalidades */}
              <Card className="border-border bg-card">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="size-4 text-primary" aria-hidden="true" />
                    Modalidades de Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div className="p-3 bg-muted/30 rounded-lg border">
                    <strong className="text-foreground block mb-1">1. Retiro en Sede</strong>
                    Talento Humano imprime el carnet oficial tras la aprobación para entrega presencial.
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg border">
                    <strong className="text-foreground block mb-1">2. Descarga Digital</strong>
                    Descargue el archivo PDF de alta resolución con su código QR para auto-impresión.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Estado sin carnet: tarjeta informativa con botón principal */
          <Card className="border-border bg-card max-w-2xl mx-auto">
            <CardHeader className="text-center pt-8 pb-4">
              <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <CreditCard className="size-8" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl font-bold text-foreground">
                Aún no posee una credencial digital activa
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground max-w-md mx-auto pt-1 leading-relaxed">
                Para identificarse oficialmente en las sedes de CONATEL, puede solicitar la emisión de su
                carnet institucional. Recursos Humanos validará su solicitud.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8 flex justify-center">
              <Button
                onClick={() => setModalAbierto(true)}
                size="lg"
                className="gap-2 font-semibold shadow-md"
              >
                <PlusCircle className="size-4" aria-hidden="true" />
                Solicitar mi carnet
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Historial de carnets */}
        {listaCarnets.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="size-4 text-primary" aria-hidden="true" />
                Historial de Credenciales Emitidas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="divide-y divide-border/60 text-sm">
                {listaCarnets.map((c: { id: number | string; motivo_nombre?: string; fecha_emision?: string; activo?: boolean }) => (
                  <div key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">
                        {c.motivo_nombre || "EMISIÓN INSTITUCIONAL"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="size-3" aria-hidden="true" />
                        {c.fecha_emision
                          ? new Date(c.fecha_emision).toLocaleDateString("es-VE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "Fecha no registrada"}
                      </p>
                    </div>
                    <div>
                      {c.activo ? (
                        <Badge className="bg-emerald-600 text-white text-xs">Vigente</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          Inactivo / Reemplazado
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Solicitud de Carnet */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5 text-primary" aria-hidden="true" />
              Solicitud de Credencial Institucional
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Complete los datos requeridos para remitir su trámite a Gestión del Talento Humano.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Titular del carnet</span>
              <div className="p-2.5 rounded-lg bg-muted/40 font-semibold text-foreground text-sm">
                {empleado.nombre_completo || `${empleado.nombres} ${empleado.apellidos}`} (C.I. {empleado.cedula})
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal_motivo_id" className="text-sm font-medium text-foreground block">
                Motivo de la solicitud *
              </label>
              <select
                id="modal_motivo_id"
                value={motivoEfectivo}
                onChange={(e) => setMotivoSeleccionado(Number(e.target.value))}
                className="w-full h-10 px-3 bg-background border border-input rounded-md text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {motivosDisponibles.length > 0 ? (
                  motivosDisponibles.map((m: { id: number; nombre: string; descripcion?: string }) => {
                    const esRepetido =
                      !m.descripcion ||
                      m.nombre.trim().toUpperCase() === m.descripcion.trim().toUpperCase();
                    const texto = esRepetido ? m.nombre : `${m.nombre} — ${m.descripcion}`;
                    return (
                      <option key={m.id} value={m.id}>
                        {texto}
                      </option>
                    );
                  })
                ) : yaTieneCredencial ? (
                  <>
                    <option value={2}>RENOVACIÓN — Vencimiento de credencial</option>
                    <option value={3}>PÉRDIDA — Extravío de credencial previa</option>
                    <option value={4}>DAÑO — Deterioro del material físico</option>
                    <option value={5}>ACTUALIZACIÓN — Cambio de cargo o adscripción</option>
                  </>
                ) : (
                  <>
                    <option value={1}>PRIMERA EMISIÓN — Nuevo ingreso a CONATEL</option>
                    <option value={2}>RENOVACIÓN — Vencimiento de credencial</option>
                    <option value={3}>PÉRDIDA — Extravío de credencial previa</option>
                    <option value={4}>DAÑO — Deterioro del material físico</option>
                    <option value={5}>ACTUALIZACIÓN — Cambio de cargo o adscripción</option>
                  </>
                )}
              </select>
              {yaTieneCredencial && (
                <p className="text-[11px] text-muted-foreground">
                  Usted ya posee una credencial; seleccione el motivo de la reposición,
                  renovación o actualización.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal_observaciones" className="text-sm font-medium text-foreground block">
                Observaciones o Justificación (Opcional)
              </label>
              <textarea
                id="modal_observaciones"
                rows={3}
                maxLength={LIMITES_TEXTO.observacion.max}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Indique detalles adicionales de su solicitud..."
                className="w-full p-2.5 bg-background border border-input rounded-md text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
              />
              <ContadorCaracteres valor={observaciones} max={LIMITES_TEXTO.observacion.max} />
            </div>

            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                Información del trámite:
              </p>
              <p>
                Al enviar la solicitud, quedará registrada para validación de Recursos Humanos.
                Una vez aprobada, podrá descargar su credencial o retirarla en la sede.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={solicitando}
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={solicitando}
              onClick={handleEnviarSolicitud}
            >
              {solicitando ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrivacidadCarnetDialog
        open={privacidadAbierta}
        onOpenChange={setPrivacidadAbierta}
      />
    </PageLayout>
  );
}
