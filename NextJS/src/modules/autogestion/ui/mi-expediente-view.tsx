"use client";

import React, { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  User,
  Building2,
  Users,
  GraduationCap,
  HeartPulse,
  Home,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  ShieldAlert,
  ArrowRight,
  Clock,
  Shirt,
  CreditCard,
  Download,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Award,
  Scale,
  FileText,
  Sparkles,
  RefreshCw,
  FileCheck,
  ShieldCheck,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/components/card";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import { ScrollArea, ScrollBar } from "@/shared/ui/components/scroll-area";
import { Skeleton } from "@/shared/ui/components/skeleton";
import { InfoRow } from "@/shared/ui/components/info-row";
import { formatearFecha, formatearFechaConEdad } from "@/shared/lib/formato-fecha";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { CarnetVistaPrevia } from "@/shared/ui/components/carnet-vista-previa";

import {
  getMiExpedienteAction,
  solicitarCarnetAction,
  descargarMiCarnetPdfAction,
} from "../infrastructure/actions/autogestion-actions";
import type {
  FormacionAcademicaItem,
  FormacionComplementariaItem,
  ContactoEmergenciaItem,
  ContratoItem,
} from "../application/dtos/mi-expediente-dto";

function formatearLista(items: unknown[] | undefined): string {
  if (!items || items.length === 0) return "Ninguna reportada";
  return items
    .map((item) => {
      if (typeof item === "object" && item !== null && "nombre" in item) {
        return String((item as { nombre: unknown }).nombre);
      }
      return String(item);
    })
    .join(", ");
}

export default function MiExpedienteView() {
  const { data, error, isLoading, mutate } = useSWR("mi-expediente-trabajador", () =>
    getMiExpedienteAction(),
  );

  const [activeTab, setActiveTab] = useState<string>("personal");
  const [modalCarnetAbierto, setModalCarnetAbierto] = useState(false);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState<number>(2);
  const [observacionesSolicitud, setObservacionesSolicitud] = useState("");
  const [solicitandoCarnet, setSolicitandoCarnet] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [feedbackCarnet, setFeedbackCarnet] = useState<{ tipo: "success" | "error"; mensaje: string } | null>(null);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data || !data.empleado) {
    return (
      <div className="p-6 max-w-4xl mx-auto mt-10">
        <Card className="border-red-500/30 bg-red-950/20 text-center p-8 rounded-2xl shadow-xl">
          <CardHeader>
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-3">
              <ShieldAlert className="w-7 h-7 text-red-400" />
            </div>
            <CardTitle className="text-xl font-bold text-white">Expediente no disponible</CardTitle>
            <CardDescription className="text-slate-300 max-w-md mx-auto pt-2">
              No fue posible recuperar su expediente de trabajador. Verifique que su cuenta institucional
              esté vinculada a su cédula en el sistema o comuníquese con la Gerencia de Gestión del Talento Humano.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { empleado, familiares, carnet_activo, carnets = [], motivos_carnet = [] } = data;
  const vivienda = empleado.datos_vivienda;
  const salud = empleado.perfil_salud;
  const fisico = empleado.perfil_fisico;
  const contratoActual = empleado.contrato_actual;
  const contratos = (empleado.contratos || []) as ContratoItem[];
  const formacion = (empleado.formacion_academica || []) as FormacionAcademicaItem[];
  const complementaria = (empleado.formacion_complementaria || []) as FormacionComplementariaItem[];
  const contactos = (empleado.contacto_emergencia || []) as ContactoEmergenciaItem[];

  const cargoPrincipal =
    contratoActual?.politica_nombre ||
    (empleado.asignaciones && empleado.asignaciones[0]?.denominacion_cargo_especifico) ||
    (empleado.asignaciones && empleado.asignaciones[0]?.denominacion_cargo) ||
    "Servidor Público CONATEL";

  const dependenciaPrincipal =
    (empleado.asignaciones && empleado.asignaciones[0]?.dependencia) ||
    (empleado.asignaciones && empleado.asignaciones[0]?.direccion_general) ||
    "Comisión Nacional de Telecomunicaciones";

  const handleDescargarCarnetPdf = async () => {
    try {
      setDescargandoPdf(true);
      const blob = await descargarMiCarnetPdfAction();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `carnet_conatel_${empleado.cedula}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setFeedbackCarnet({
        tipo: "error",
        mensaje: "No se pudo descargar el carnet en PDF. Verifique que posee un carnet activo emitido.",
      });
    } finally {
      setDescargandoPdf(false);
    }
  };

  const handleSolicitarCarnet = async (e: React.FormEvent) => {
    e.preventDefault();
    setSolicitandoCarnet(true);
    setFeedbackCarnet(null);
    try {
      const res = await solicitarCarnetAction({
        motivo_id: motivoSeleccionado,
        observaciones: observacionesSolicitud.trim() || undefined,
      });

      if (res.success) {
        setFeedbackCarnet({
          tipo: "success",
          mensaje:
            res.message ||
            "¡Solicitud registrada exitosamente! Su trámite de carnet ha sido remitido a Gestión del Talento Humano. Una vez aprobada, podrá retirarlo impreso en la sede o descargarlo en PDF.",
        });
        setModalCarnetAbierto(false);
        setObservacionesSolicitud("");
        await mutate();
      } else {
        setFeedbackCarnet({
          tipo: "error",
          mensaje: res.message || "Ocurrió un error al procesar la solicitud del carnet.",
        });
      }
    } catch {
      setFeedbackCarnet({
        tipo: "error",
        mensaje: "Error de comunicación al solicitar el carnet institucional.",
      });
    } finally {
      setSolicitandoCarnet(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {feedbackCarnet && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm shadow-md transition-all ${
            feedbackCarnet.tipo === "success"
              ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/40 border border-rose-500/40 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {feedbackCarnet.tipo === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedbackCarnet.mensaje}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs hover:bg-white/10"
            onClick={() => setFeedbackCarnet(null)}
          >
            Cerrar
          </Button>
        </div>
      )}

      {/* Cabecera Institucional CONATEL */}
      <Card className="overflow-hidden border-border/50 shadow-2xl bg-card rounded-2xl border-t-4 border-t-amber-500">
        <div className="bg-gradient-to-r from-[#001737] via-[#002b5c] to-[#0a1e3f] p-6 md:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 h-1.5 w-48 bg-gradient-to-r from-amber-400 via-blue-500 to-red-500 rounded-bl-full opacity-80" />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="relative shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-blue-600/40 to-slate-900/60 border-2 border-amber-400/40 flex items-center justify-center shadow-xl backdrop-blur-sm overflow-hidden">
                  {empleado.foto_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={empleado.foto_url}
                      alt={`Fotografía del trabajador ${empleado.nombre_completo || ""}`.trim()}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    <User className="w-10 h-10 sm:w-12 sm:h-12 text-amber-300" />
                  )}
                </div>
                {carnet_activo?.activo && (
                  <span
                    title="Carnet Digital Activo"
                    className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 shadow-md border-2 border-[#001737]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold tracking-wider text-amber-300 uppercase px-3 py-1 rounded-md bg-amber-400/15 border border-amber-400/30">
                    CONATEL • GATH
                  </span>
                  <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/25 text-sm font-mono px-3 py-0.5">
                    C.I. {empleado.cedula}
                  </Badge>
                  {carnet_activo ? (
                    <Badge className="bg-emerald-600/90 text-white hover:bg-emerald-600 text-sm gap-1.5 py-0.5 px-3">
                      <FileCheck className="w-3.5 h-3.5" /> Carnet Vigente
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400/50 text-amber-300 text-sm py-0.5 px-3">
                      Sin carnet emitido
                    </Badge>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                  {empleado.nombre_completo || `${empleado.nombres} ${empleado.apellidos}`}
                </h1>

                <p className="text-blue-100 text-sm sm:text-base font-medium flex items-center gap-2 flex-wrap">
                  <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 shrink-0" />
                  <span className="font-semibold text-white">{cargoPrincipal}</span>
                  <span className="text-blue-300/70">•</span>
                  <span className="text-blue-200">{dependenciaPrincipal}</span>
                </p>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-sm text-blue-100 pt-1">
                  {empleado.correo && (
                    <span className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-amber-300 shrink-0" /> {empleado.correo}
                    </span>
                  )}
                  {empleado.telefono_movil && (
                    <span className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-amber-300 shrink-0" /> {empleado.telefono_movil}
                    </span>
                  )}
                  {empleado.total_anos_apn !== undefined && (
                    <span className="flex items-center gap-2 font-semibold text-amber-200">
                      <Clock className="w-4 h-4 text-amber-300 shrink-0" /> {empleado.total_anos_apn} años de servicio en APN
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-row lg:flex-col items-center lg:items-end gap-3 w-full lg:w-auto shrink-0">
              <Button
                onClick={() => setActiveTab("carnet")}
                className="flex-1 lg:flex-none bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold shadow-lg text-sm h-11 px-5 gap-2"
              >
                <CreditCard className="w-4 h-4 text-slate-950" /> Mi Carnet Digital
              </Button>

              <Link href="/autogestion/censo" className="flex-1 lg:flex-none">
                <Button
                  variant="outline"
                  className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white text-sm font-medium h-11 px-5 gap-2"
                >
                  <Home className="w-4 h-4 text-blue-200" /> Censo de Vivienda <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* Navegación por Pestañas con ScrollArea de shadcn */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto p-1.5 bg-muted/80 rounded-xl border border-border/50 min-w-full sm:min-w-0 justify-start sm:justify-center gap-1.5">
            <TabsTrigger value="personal" className="py-2.5 px-4 text-sm font-medium gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <User className="w-4 h-4 text-blue-500" /> Datos Personales
            </TabsTrigger>
            <TabsTrigger value="laboral" className="py-2.5 px-4 text-sm font-medium gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Briefcase className="w-4 h-4 text-indigo-500" /> Ubicación Laboral
            </TabsTrigger>
            <TabsTrigger value="formacion" className="py-2.5 px-4 text-sm font-medium gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <GraduationCap className="w-4 h-4 text-emerald-500" /> Formación & Cursos ({formacion.length + complementaria.length})
            </TabsTrigger>
            <TabsTrigger value="carnet" className="py-2.5 px-4 text-sm font-medium gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <CreditCard className="w-4 h-4 text-amber-500" /> Carnet Institucional
            </TabsTrigger>
            <TabsTrigger value="salud" className="py-2.5 px-4 text-sm font-medium gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <HeartPulse className="w-4 h-4 text-rose-500" /> Salud & Dotación
            </TabsTrigger>
            <TabsTrigger value="familiares" className="py-2.5 px-4 text-sm font-medium gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 text-violet-500" /> Cargas Familiares ({familiares.length})
            </TabsTrigger>
            <TabsTrigger value="legal" className="py-2.5 px-4 text-sm font-medium gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Scale className="w-4 h-4 text-amber-600" /> Marco Legal
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* TAB 1: DATOS PERSONALES & HABITACIÓN */}
        <TabsContent value="personal" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <User className="w-5 h-5 text-blue-600" /> Identificación & Datos de Contacto
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Datos biográficos oficiales registrados en CONATEL.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border/40 pt-2">
                <InfoRow label="Cédula de Identidad" value={
                    empleado.cedula
                      ? empleado.nacionalidad_codigo
                        ? `${empleado.nacionalidad_codigo}-${empleado.cedula}`
                        : empleado.cedula
                      : "No posee"
                  } />
                <InfoRow label="Nombres" value={empleado.nombres} />
                <InfoRow label="Apellidos" value={empleado.apellidos} />
                <InfoRow label="Sexo" value={empleado.sexo_nombre} />
                <InfoRow label="Fecha de Nacimiento" value={formatearFechaConEdad(empleado.fecha_nacimiento)} />
                <InfoRow label="Estado Civil" value={empleado.estado_civil_nombre} />
                <InfoRow label="Carnet de la Patria" value={empleado.carnet_patria} emptyText="No reportado" />
                <InfoRow label="Teléfono Móvil" value={empleado.telefono_movil} emptyText="No posee" />
                <InfoRow label="Teléfono Habitación" value={empleado.telefono_habitacion} emptyText="No posee" />
                <InfoRow label="Correo Institucional" value={empleado.correo} emptyText="No posee" />
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Home className="w-5 h-5 text-blue-600" /> Datos de Domicilio & Vivienda
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Residencia habitual vinculada al expediente institucional.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border/40 pt-2">
                <InfoRow label="Estado" value={vivienda?.estado_nombre || (vivienda?.estado_id ? `Estado #${vivienda.estado_id}` : null)} />
                <InfoRow label="Municipio" value={vivienda?.municipio_nombre || (vivienda?.municipio_id ? `Municipio #${vivienda.municipio_id}` : null)} />
                <InfoRow label="Parroquia" value={vivienda?.parroquia_nombre || (vivienda?.parroquia_id ? `Parroquia #${vivienda.parroquia_id}` : null)} />
                <InfoRow label="Código Postal" value={vivienda?.codigo_postal_nombre || (vivienda?.codigo_postal_id ? String(vivienda.codigo_postal_id) : null)} />
                <InfoRow label="Condición de Vivienda" value={vivienda?.condicion_vivienda_nombre || (vivienda?.condicion_vivienda_id ? `Tipo #${vivienda.condicion_vivienda_id}` : null)} />
                <InfoRow label="Dirección Exacta" value={vivienda?.direccion_exacta || null} />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <Phone className="w-5 h-5 text-blue-600" /> Contactos para Casos de Emergencia
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Personas de enlace en caso de contingencias médicas o laborales.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {contactos.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No se registran contactos de emergencia en el expediente.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {contactos.map((c, idx) => (
                    <div key={idx} className="p-4 border rounded-xl space-y-2 bg-card hover:border-blue-300 transition-colors shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-base text-foreground">
                          {c.nombres} {c.apellidos}
                        </div>
                        <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                          {c.relacion_nombre || "Contacto"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1">
                        <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Teléfono: <strong className="text-foreground font-semibold">{c.telefono || "Sin teléfono registrado"}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: TRAYECTORIA LABORAL & CARGO */}
        <TabsContent value="laboral" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Building2 className="w-5 h-5 text-indigo-600" /> Estructura y Ubicación Administrativa
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Adscripción formal del servidor dentro de CONATEL.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border/40 pt-2">
                <InfoRow label="Dependencia Principal" value={dependenciaPrincipal} />
                <InfoRow
                  label="Dirección de Línea"
                  value={(empleado.asignaciones && empleado.asignaciones[0]?.direccion_linea) || "Sede Principal CONATEL"}
                />
                <InfoRow
                  label="Coordinación"
                  value={(empleado.asignaciones && empleado.asignaciones[0]?.coordinacion) || "Área Operativa"}
                />
                <InfoRow
                  label="Tipo de Nómina"
                  value={(empleado.asignaciones && empleado.asignaciones[0]?.tipo_nomina) || "EMPLEADOS FIJOS"}
                />
                <InfoRow
                  label="Grado / Escala"
                  value={(empleado.asignaciones && empleado.asignaciones[0]?.grado) || "N/A"}
                />
                <InfoRow
                  label="Modalidad de Ingreso al Cargo"
                  value={
                    empleado.asignaciones &&
                    empleado.asignaciones[0]?.tipo_procedencia &&
                    empleado.asignaciones[0]?.tipo_procedencia !== "N/A"
                      ? `${empleado.asignaciones[0].tipo_procedencia} (CONATEL)`
                      : "Captación Institucional (Interna)"
                  }
                />
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Briefcase className="w-5 h-5 text-indigo-600" /> Cargo y Estatus Contractual Vigente
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Régimen de relación laboral y condiciones de contratación.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border/40 pt-2">
                <InfoRow
                  label="Denominación del Cargo"
                  value={cargoPrincipal}
                />
                <InfoRow
                  label="Código de Cargo"
                  value={(empleado.asignaciones && empleado.asignaciones[0]?.codigo) || "S/C"}
                />
                <InfoRow
                  label="N° Contrato Activo"
                  value={contratoActual?.n_contrato || "Contrato Institucional"}
                />
                <InfoRow
                  label="Política de Contratación"
                  value={contratoActual?.politica_nombre || (contratoActual?.es_fijo ? "PERSONAL FIJO" : "CONTRATADO")}
                />
                <InfoRow
                  label="Fecha de Ingreso"
                  value={contratoActual?.fecha_ingreso ? formatearFecha(contratoActual.fecha_ingreso) : "Registrada en Antecedentes"}
                />
                <InfoRow
                  label="Fecha de Culminación"
                  value={contratoActual?.fecha_culminacion ? formatearFecha(contratoActual.fecha_culminacion) : "Indefinido / Permanente"}
                />
                <InfoRow
                  label="Tiempo de Servicio APN"
                  value={empleado.total_anos_apn !== undefined ? `${empleado.total_anos_apn} años continuos` : null}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <Calendar className="w-5 h-5 text-indigo-600" /> Historial de Contratos en la Institución
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Registro cronológico de renovaciones contractuales y asignaciones.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-sm font-semibold px-3 py-0.5">
                  {contratos.length} {contratos.length === 1 ? "contrato" : "contratos"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {contratos.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No se registran contratos anteriores en el expediente.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-sm">
                        <TableHead className="font-semibold text-foreground">N° Contrato</TableHead>
                        <TableHead className="font-semibold text-foreground">Régimen / Política</TableHead>
                        <TableHead className="font-semibold text-foreground">Fecha Ingreso</TableHead>
                        <TableHead className="font-semibold text-foreground">Fecha Culminación</TableHead>
                        <TableHead className="font-semibold text-foreground">Condición</TableHead>
                        <TableHead className="font-semibold text-foreground">Estatus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-sm">
                      {contratos.map((con, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono font-semibold text-foreground">
                            {con.n_contrato}
                          </TableCell>
                          <TableCell className="font-medium">{con.politica_nombre || "CONTRATO GENERAL"}</TableCell>
                          <TableCell>{formatearFecha(con.fecha_ingreso, "-")}</TableCell>
                          <TableCell>{formatearFecha(con.fecha_culminacion, "Permanente")}</TableCell>
                          <TableCell>
                            {con.es_fijo ? (
                              <Badge className="bg-blue-600 text-white text-xs font-semibold px-2.5 py-0.5">FIJO</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">DETERMINADO</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={con.estatus_nombre === "ACTIVO" ? "default" : "secondary"}
                              className={`text-xs font-semibold px-2.5 py-0.5 ${con.estatus_nombre === "ACTIVO" ? "bg-emerald-600 text-white" : ""}`}
                            >
                              {con.estatus_nombre || "ACTIVO"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: FORMACIÓN ACADÉMICA & CURSOS */}
        <TabsContent value="formacion" className="space-y-6 focus-visible:outline-none">
          <Card className="border-border/60 shadow-sm border-t-2 border-t-emerald-500">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <Award className="w-5 h-5 text-emerald-600" /> Formación Complementaria, Cursos & Capacitaciones
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Cursos certificados, talleres institucionales y adiestramiento profesional completado.
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-600 text-white text-sm font-semibold px-3 py-0.5 w-fit">
                  {complementaria.length} {complementaria.length === 1 ? "capacitación registrada" : "capacitaciones registradas"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {complementaria.length === 0 ? (
                <div className="p-8 text-center space-y-3 bg-muted/20 rounded-xl border border-dashed border-border/80">
                  <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
                  <p className="text-base font-semibold text-foreground">
                    Sin cursos de formación complementaria registrados actualmente
                  </p>
                  <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                    La Comisión Nacional de Telecomunicaciones promueve la capacitación permanente. Para consignar
                    certificados de cursos o solicitar inclusión de adiestramiento, presente sus credenciales ante el
                    área de Capacitación y Desarrollo de Talento Humano.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {complementaria.map((fc, idx) => (
                    <div
                      key={idx}
                      className="p-4 border border-border/70 rounded-xl bg-card hover:border-emerald-400/70 hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-base text-foreground leading-snug">
                            {fc.capacitacion_nombre || "Curso / Taller de Capacitación"}
                          </h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{fc.institucion_nombre || "Institución Acreditada"}</span>
                          </p>
                        </div>
                        {fc.horas_completadas && (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono text-xs font-semibold px-2.5 py-0.5 shrink-0">
                            {fc.horas_completadas} hrs
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground pt-2 border-t border-border/40">
                        {fc.fecha_inicio && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            Desde: {formatearFecha(fc.fecha_inicio)} {fc.fecha_fin ? `hasta ${formatearFecha(fc.fecha_fin)}` : ""}
                          </span>
                        )}
                        {fc.dias_completados && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            Duración: {fc.dias_completados} días
                          </span>
                        )}
                        {fc.procedencia_nombre && (
                          <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 uppercase">
                            {fc.procedencia_nombre}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <GraduationCap className="w-5 h-5 text-emerald-600" /> Títulos Académicos y Educación Formal
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Niveles de instrucción superior, pregrado, postgrado y especializaciones.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-sm font-semibold px-3 py-0.5">{formacion.length} títulos</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {formacion.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Sin registros académicos en el expediente.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formacion.map((fa, idx) => (
                    <div
                      key={idx}
                      className="p-4 border border-border/70 rounded-xl bg-card hover:border-emerald-300 transition-colors space-y-2 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-base text-foreground">
                            {fa.carrera_nombre || "Carrera Profesional"}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {fa.institucion_nombre || "Universidad / Instituto de Educación Superior"}
                          </p>
                        </div>
                        <Badge className="bg-blue-600/90 text-white text-xs font-semibold px-2.5 py-0.5">
                          {fa.nivel_academico_nombre || "SUPERIOR"}
                        </Badge>
                      </div>

                      {fa.mencion_nombre && (
                        <p className="text-sm text-muted-foreground pt-1.5 border-t border-border/40">
                          Mención: <strong className="text-foreground font-semibold">{fa.mencion_nombre}</strong>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: MI CARNET INSTITUCIONAL */}
        <TabsContent value="carnet" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4 bg-muted/20 p-6 rounded-2xl border border-border/60 shadow-sm">
              <div className="text-center space-y-1">
                <h3 className="font-bold text-sm text-foreground flex items-center justify-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-amber-500" /> Credencial Digital Oficial
                </h3>
                <p className="text-xs text-muted-foreground">
                  Formato estándar CR80 con código QR criptográfico de autenticidad.
                </p>
              </div>

              <div className="transform hover:scale-[1.02] transition-transform duration-300">
                <CarnetVistaPrevia
                  cedula={empleado.cedula}
                  nombreCompleto={empleado.nombre_completo || `${empleado.nombres} ${empleado.apellidos}`}
                  cargo={cargoPrincipal}
                  departamento={dependenciaPrincipal}
                  codigo={(empleado.asignaciones && empleado.asignaciones[0]?.codigo) || undefined}
                  fotoUrl={empleado.foto_url}
                />
              </div>

              <div className="text-center pt-2">
                <span className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-500" /> Documento oficial de identificación institucional CONATEL
                </span>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-4 border-b bg-muted/20">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                        <Sparkles className="w-5 h-5 text-amber-500" /> Estado de Carnetización
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        Acreditación activa de seguridad física e institucional.
                      </CardDescription>
                    </div>
                    {carnet_activo ? (
                      <Badge className="bg-emerald-600 text-white gap-1.5 py-1 px-3.5 text-sm font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> Activo y Vigente
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-500 py-1 px-3.5 text-sm font-semibold">
                        Requiere Emisión
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {carnet_activo ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="p-3.5 bg-muted/40 rounded-xl space-y-1">
                          <span className="text-muted-foreground block text-xs font-medium">Motivo de Emisión:</span>
                          <span className="font-bold text-base text-foreground">
                            {carnet_activo.motivo_nombre || "PRIMERA EMISIÓN"}
                          </span>
                        </div>
                        <div className="p-3.5 bg-muted/40 rounded-xl space-y-1">
                          <span className="text-muted-foreground block text-xs font-medium">Fecha de Expedición:</span>
                          <span className="font-bold text-base text-foreground">
                            {carnet_activo.fecha_emision ? new Date(carnet_activo.fecha_emision).toLocaleDateString("es-VE", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            }) : "Fecha oficial registrada"}
                          </span>
                        </div>
                      </div>

                      {carnet_activo.security_hash && (
                        <div className="p-3.5 bg-muted/30 border border-border/50 rounded-xl space-y-1.5 text-sm">
                          <span className="text-muted-foreground block text-xs font-semibold">
                            Hash Criptográfico de Verificación SHA-256:
                          </span>
                          <span className="font-mono text-xs break-all text-blue-600 dark:text-blue-400 select-all block">
                            {carnet_activo.security_hash}
                          </span>
                        </div>
                      )}

                      {carnet_activo.observaciones && (
                        <div className="text-sm text-muted-foreground italic">
                          Observaciones: {carnet_activo.observaciones}
                        </div>
                      )}

                      {/* Información de entrega física vs descarga digital */}
                      <div className="p-4 bg-muted/40 border border-border/60 rounded-xl space-y-2.5 text-sm">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-500" /> Modalidades de Entrega y Emisión:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                          <div className="p-3 bg-card rounded-lg border border-border/50">
                            <strong className="text-foreground block mb-1">1. Retiro Impreso en CONATEL</strong>
                            Talento Humano imprime el carnet institucional oficial tras la aprobación para su entrega presencial en la sede.
                          </div>
                          <div className="p-3 bg-card rounded-lg border border-border/50">
                            <strong className="text-foreground block mb-1">2. Descarga Digital (Auto-impresión)</strong>
                            También puede descargar el archivo digital en PDF para imprimirlo por su cuenta cuando lo requiera.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm space-y-2 text-amber-200">
                      <p className="font-bold text-amber-400 text-base">Aún no posee una credencial física o digital activa registrada.</p>
                      <p className="leading-relaxed">
                        Presione el botón a continuación para solicitar la emisión formal de su carnet institucional
                        avalado por la Gerencia de Gestión del Talento Humano de CONATEL. Deberá esperar la aprobación
                        institucional para retirarlo impreso en sede o descargarlo en PDF.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    {carnet_activo && (
                      <Button
                        onClick={handleDescargarCarnetPdf}
                        disabled={descargandoPdf}
                        className="w-full sm:w-auto bg-[#002b5c] hover:bg-[#001737] text-white gap-2 font-semibold text-sm h-11 px-6 shadow"
                      >
                        {descargandoPdf ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 text-amber-400" />
                        )}
                        Descargar Carnet PDF (Imprimible)
                      </Button>
                    )}

                    <Button
                      onClick={() => setModalCarnetAbierto(true)}
                      variant={carnet_activo ? "outline" : "default"}
                      className={`w-full sm:w-auto gap-2 font-bold text-sm h-11 px-6 ${
                        !carnet_activo ? "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md" : ""
                      }`}
                    >
                      <PlusCircle className="w-4 h-4" />
                      {carnet_activo ? "Solicitar Renovación de Carnet" : "Solicitar Mi Carnet"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {carnets.length > 0 && (
                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                      <FileText className="w-4 h-4 text-primary" /> Registro de Credenciales Emitidas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <div className="divide-y divide-border/40 text-sm">
                      {carnets.map((c) => (
                        <div key={c.id} className="py-3 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-foreground text-sm">{c.motivo_nombre || "Emisión de Carnet"}</span>
                            <span className="text-muted-foreground block text-xs mt-0.5">
                              Emitido el: {c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString("es-VE") : "N/A"}
                            </span>
                          </div>
                          <div>
                            {c.activo ? (
                              <Badge className="bg-emerald-600 text-white text-xs font-semibold px-2.5 py-0.5">ACTIVO</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5">INACTIVO / RENOVADO</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 5: SALUD & BIENESTAR / TALLAS */}
        <TabsContent value="salud" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <HeartPulse className="w-5 h-5 text-rose-600" /> Ficha Médica y Condiciones de Salud
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">Información médica confidencial para atención y primeros auxilios.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border/40 pt-2">
                <InfoRow
                  label="Grupo Sanguíneo"
                  value={salud?.grupo_sanguineo_nombre || "No reportado"}
                />
                <InfoRow
                  label="Alergias Conocidas"
                  value={
                    salud?.alergias_nombres && salud.alergias_nombres.length > 0
                      ? salud.alergias_nombres.join(", ")
                      : formatearLista(salud?.alergias as unknown[] | undefined)
                  }
                />
                <InfoRow
                  label="Patologías Crónicas"
                  value={
                    salud?.patologias_cronicas_nombres && salud.patologias_cronicas_nombres.length > 0
                      ? salud.patologias_cronicas_nombres.join(", ")
                      : formatearLista(salud?.patologias_cronicas as unknown[] | undefined)
                  }
                />
                <InfoRow
                  label="Discapacidades"
                  value={
                    salud?.discapacidades_nombres && salud.discapacidades_nombres.length > 0
                      ? salud.discapacidades_nombres.join(", ")
                      : formatearLista(salud?.discapacidades as unknown[] | undefined)
                  }
                />
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Shirt className="w-5 h-5 text-rose-600" /> Tallas y Dotación de Uniforme
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">Parámetros para suministro de dotación laboral institucional.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border/40 pt-2">
                <InfoRow
                  label="Talla de Camisa / Chemise"
                  value={fisico?.talla_camisa_nombre || (fisico?.talla_camisa_id ? `Talla #${fisico.talla_camisa_id}` : "Sin registrar")}
                />
                <InfoRow
                  label="Talla de Pantalón"
                  value={fisico?.talla_pantalon_nombre || (fisico?.talla_pantalon_id ? `Talla #${fisico.talla_pantalon_id}` : "Sin registrar")}
                />
                <InfoRow
                  label="Calzado (Zapatos)"
                  value={fisico?.talla_zapatos_nombre || (fisico?.talla_zapatos_id ? `Talla #${fisico.talla_zapatos_id}` : "Sin registrar")}
                />
                <InfoRow
                  label="Talla de Chaqueta / Abrigo"
                  value={fisico?.talla_chaqueta_nombre || (fisico?.talla_chaqueta_id ? `Talla #${fisico.talla_chaqueta_id}` : "Sin registrar")}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 6: CARGAS FAMILIARES */}
        <TabsContent value="familiares" className="space-y-6 focus-visible:outline-none">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <Users className="w-5 h-5 text-violet-600" /> Cargas Familiares Registradas
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Hijos, cónyuge o ascendientes vinculados formalmente a su expediente laboral.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-sm font-semibold px-3 py-0.5">
                  {familiares.length} {familiares.length === 1 ? "dependiente" : "dependientes"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {familiares.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No posee cargas familiares registradas en su expediente.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-sm">
                        <TableHead className="font-semibold text-foreground">Parentesco</TableHead>
                        <TableHead className="font-semibold text-foreground">Nombres y Apellidos</TableHead>
                        <TableHead className="font-semibold text-foreground">Cédula</TableHead>
                        <TableHead className="font-semibold text-foreground">Fecha Nacimiento</TableHead>
                        <TableHead className="font-semibold text-foreground">Sexo</TableHead>
                        <TableHead className="font-semibold text-foreground">Heredero Legal</TableHead>
                        <TableHead className="font-semibold text-foreground">¿Labora en CONATEL?</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-sm">
                      {familiares.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-bold text-violet-600 dark:text-violet-400">
                            {f.parentesco_nombre}
                          </TableCell>
                          <TableCell className="font-medium">
                            {f.primer_nombre} {f.segundo_nombre || ""} {f.primer_apellido} {f.segundo_apellido || ""}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {f.cedula_familiar || "Menor / S.C."}
                          </TableCell>
                          <TableCell>{formatearFechaConEdad(f.fecha_nacimiento)}</TableCell>
                          <TableCell>{f.sexo_nombre}</TableCell>
                          <TableCell>
                            {f.heredero ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-0.5">
                                SÍ
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">No</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {f.mismo_ente ? (
                              <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5 text-blue-600 dark:text-blue-400">
                                CONATEL
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">No</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 7: MARCO LEGAL INSTITUCIONAL CONATEL */}
        <TabsContent value="legal" className="space-y-6 focus-visible:outline-none">
          <Card className="border-border/60 shadow-sm border-l-4 border-l-amber-500">
            <CardHeader className="pb-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">
                    Fundamentos Jurídicos y Bases Legales de CONATEL
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Marco normativo que rige la relación de empleo público, las telecomunicaciones y la seguridad social.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="space-y-3">
                <h4 className="font-bold text-base text-foreground flex items-center gap-2 border-b pb-1.5">
                  <BookOpen className="w-4 h-4 text-blue-600" /> Constitución de la República Bolivariana de Venezuela (CRBV)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-1.5">
                    <strong className="text-primary font-semibold block text-base">Artículo 86 (Seguridad Social)</strong>
                    <p className="text-muted-foreground leading-relaxed">
                      Toda persona tiene derecho a la seguridad social como servicio público de carácter no lucrativo, que
                      garantice la salud y asegure protección en contingencias de maternidad, paternidad, enfermedad, invalidez,
                      enfermedades catastróficas, desempleo, vejez y cargas de familia.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-1.5">
                    <strong className="text-primary font-semibold block text-base">Artículo 87 (Derecho y Deber al Trabajo)</strong>
                    <p className="text-muted-foreground leading-relaxed">
                      Toda persona tiene derecho al trabajo y el deber de trabajar. El Estado garantizará la adopción de las medidas
                      necesarias para que toda persona pueda obtener una ocupación productiva bajo condiciones dignas, seguras e higiénicas.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-1.5">
                    <strong className="text-primary font-semibold block text-base">Artículo 89 (Principios Laborales)</strong>
                    <p className="text-muted-foreground leading-relaxed">
                      El trabajo es un hecho social y gozará de la protección del Estado. Principios de intangibilidad y progresividad de los
                      derechos laborales; primacía de la realidad sobre formas o apariencias, e irrenunciabilidad de los derechos del trabajador.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-1.5">
                    <strong className="text-primary font-semibold block text-base">Artículos 108 y 110 (Telecomunicaciones y Soberanía)</strong>
                    <p className="text-muted-foreground leading-relaxed">
                      Los medios de comunicación social públicos y privados coadyuvarán en la difusión de los valores. El Estado reconoce el
                      interés público de la ciencia, la tecnología, el conocimiento, la innovación y los servicios de información indispensables
                      para la soberanía del país.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-base text-foreground flex items-center gap-2 border-b pb-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" /> Leyes Rectoras del Régimen Institucional
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-2">
                    <div className="font-bold text-foreground flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">LOTEL</Badge>
                      <span>Ley Orgánica de Telecomunicaciones</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Gaceta Oficial N° 36.970 / N° 39.610. Norma matriz que establece el régimen general de las telecomunicaciones y crea a la
                      Comisión Nacional de Telecomunicaciones (CONATEL) como instituto rector con personería jurídica y patrimonio propio.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-2">
                    <div className="font-bold text-foreground flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">LEFP</Badge>
                      <span>Ley del Estatuto de la Función Pública</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Rige las relaciones de empleo público entre los funcionarios y la Administración Pública Nacional. Garantiza la estabilidad,
                      evaluación de desempeño por mérito, capacitación continua y deberes de probidad en el servicio público.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-2">
                    <div className="font-bold text-foreground flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">LOTTT</Badge>
                      <span>Ley Orgánica del Trabajo</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Garantiza los derechos irrenunciables de los trabajadores y trabajadoras: prestaciones sociales, régimen de vacaciones,
                      beneficios de alimentación, salud ocupacional y convenciones colectivas vigentes en el sector público.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm space-y-2">
                <div className="font-bold text-amber-500 flex items-center gap-2 text-base">
                  <ShieldAlert className="w-5 h-5" /> Reglamentos Internos y Acreditación Institucional
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  El uso del Carnet Institucional es personal e intransferible, de portación obligatoria dentro de las instalaciones de
                  CONATEL y en el ejercicio de comisiones de servicio oficiales. La falsificación, alteración o préstamo de credenciales
                  constituye falta grave sujeta a los procedimientos disciplinarios de la Ley del Estatuto de la Función Pública.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Dialog: Solicitar / Renovar Carnet */}
      <Dialog open={modalCarnetAbierto} onOpenChange={setModalCarnetAbierto}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSolicitarCarnet}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground text-lg font-bold">
                <CreditCard className="w-5 h-5 text-amber-500" />
                {carnet_activo ? "Solicitud de Renovación de Carnet Institucional" : "Solicitud de Carnet Institucional"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Consigne los datos correspondientes para tramitar formalmente su credencial ante la Gerencia de Gestión del Talento Humano.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground block text-sm">Titular del Carnet:</label>
                <div className="p-3 bg-muted/40 rounded-lg text-foreground font-semibold text-sm">
                  {empleado.nombre_completo || `${empleado.nombres} ${empleado.apellidos}`} (C.I. {empleado.cedula})
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="motivo_id" className="font-semibold text-foreground block text-sm">
                  Motivo de la Emisión / Solicitud:
                </label>
                <select
                  id="motivo_id"
                  value={motivoSeleccionado}
                  onChange={(e) => setMotivoSeleccionado(Number(e.target.value))}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {motivos_carnet.length > 0 ? (
                    motivos_carnet.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} - {m.descripcion}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value={1}>PRIMERA EMISIÓN - Nuevo ingreso a CONATEL</option>
                      <option value={2}>RENOVACIÓN - Vencimiento de credencial</option>
                      <option value={3}>PÉRDIDA - Extravío de credencial previa</option>
                      <option value={4}>DAÑO - Deterioro del material físico</option>
                      <option value={5}>ACTUALIZACIÓN - Cambio de cargo o adscripción</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="observaciones" className="font-semibold text-foreground block text-sm">
                  Observaciones / Justificación (Opcional):
                </label>
                <textarea
                  id="observaciones"
                  rows={3}
                  value={observacionesSolicitud}
                  onChange={(e) => setObservacionesSolicitud(e.target.value)}
                  placeholder="Indique detalles relevantes (ej. carnet deteriorado, vencimiento o cambio de adscripción)..."
                  className="w-full p-3 bg-background border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Información sobre el proceso de aprobación y modalidades de entrega */}
              <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-2 text-sm text-blue-900 dark:text-blue-200">
                <div className="font-bold flex items-center gap-2 text-blue-800 dark:text-blue-300">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  Información sobre el proceso de aprobación y entrega:
                </div>
                <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-xs sm:text-sm">
                  <li>
                    <strong>Requiere Aprobación:</strong> El carnet no se emite en el acto; debe esperar la validación y aprobación por parte de la Gerencia de Gestión del Talento Humano.
                  </li>
                  <li>
                    <strong>Retiro Impreso en CONATEL:</strong> Una vez aprobada la solicitud, el organismo emite el carnet impreso oficial para que pueda retirarlo personalmente en la sede.
                  </li>
                  <li>
                    <strong>Descarga Digital (Auto-impresión):</strong> Si lo prefiere o lo requiere con inmediatez tras la aprobación, también tendrá habilitada la descarga del PDF de alta resolución con código QR para imprimirlo por su cuenta.
                  </li>
                </ul>
              </div>
            </div>

            <DialogFooter className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={solicitandoCarnet}
                onClick={() => setModalCarnetAbierto(false)}
                className="text-sm font-medium"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={solicitandoCarnet}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm gap-2 shadow-md h-11 px-6"
              >
                {solicitandoCarnet ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {solicitandoCarnet
                  ? "Enviando Solicitud..."
                  : carnet_activo
                    ? "Solicitar Renovación de Carnet"
                    : "Enviar Solicitud de Carnet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
