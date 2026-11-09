"use client";

/**
 * Pantalla de Configuración de Correo de Acceso y Aplicación Masiva (A7 / FIX-DIS3).
 * Rediseño profesional:
 * - Tarjetas con jerarquía clara y concisa.
 * - Activos y Pasivos lado a lado con la misma estructura.
 * - Estado actual visible con badge de política vigente.
 * - Ayuda en icono emergente en lugar de párrafos extensos.
 * - Aplicación en lote estructurada en pasos guiados 1-2-3.
 * - Exportación de vista previa a Excel institucional (.xlsx) vía backend, nunca CSV.
 * - Jerarquía estricta de botones (primario solo la acción final).
 */
import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
  Mail,
  RefreshCw,
  Save,
  ShieldAlert,
  Users,
} from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { guardarArchivo } from "@/shared/lib/exportaciones-asincronas";
import type {
  PoliticaCorreoAccesoDTO,
  PoliticaFalta,
  PoliticaFuente,
  ResumenVistaPreviaDTO,
} from "../application/dtos/correo-acceso-dto";
import {
  actualizarPoliticaCorreoAccesoAction,
  aplicarPoliticaCorreoAccesoMasivoAction,
  descargarExcelVistaPreviaCorreoAccesoAction,
  obtenerPoliticaCorreoAccesoAction,
  obtenerVistaPreviaCorreoAccesoAction,
} from "../infrastructure/actions/correo-acceso-actions";

function obtenerEtiquetaFuente(fuente: string): string {
  switch (fuente) {
    case "institucional":
      return "Correo institucional";
    case "alternativo":
      return "Correo alternativo";
    case "correo_ficha":
      return "Correo de la ficha";
    default:
      return fuente;
  }
}

export function ConfiguracionCorreoAccesoPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVer = tienePermiso(permisos, "configuracion.ver");
  const puedeEditar = tienePermiso(permisos, "configuracion.editar");

  const [politica, setPolitica] = useState<PoliticaCorreoAccesoDTO>({
    politica_pasivos: "institucional",
    politica_activos: "institucional",
    si_falta_elegido: "dejar_sin_cuenta",
    avisar_al_aplicar_masivo: false,
  });

  const [politicaOriginal, setPoliticaOriginal] = useState<PoliticaCorreoAccesoDTO | null>(null);

  const [cargando, startTransition] = useTransition();
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  // Estado del asistente de aplicación en lote (modal 1-2-3)
  const [modalAbierta, setModalAbierta] = useState(false);
  const [pasoLote, setPasoLote] = useState<1 | 2 | 3>(1);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<"activos" | "pasivos">("pasivos");
  const [incluirExcepciones, setIncluirExcepciones] = useState(false);
  const [cargandoVistaPrevia, setCargandoVistaPrevia] = useState(false);
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState<ResumenVistaPreviaDTO | null>(null);
  const [motivoAplicacion, setMotivoAplicacion] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [aplicandoLote, setAplicandoLote] = useState(false);

  useEffect(() => {
    if (!puedeVer) return;
    startTransition(async () => {
      setErrorGlobal(null);
      const res = await obtenerPoliticaCorreoAccesoAction();
      if ("error" in res) {
        setErrorGlobal(res.error);
        return;
      }
      const normalizada: PoliticaCorreoAccesoDTO = {
        ...res,
        politica_pasivos:
          res.politica_pasivos === "alternativo" ? "institucional" : res.politica_pasivos,
      };
      setPolitica(normalizada);
      setPoliticaOriginal(normalizada);
    });
  }, [puedeVer]);

  const handleGuardarPolitica = async () => {
    if (!puedeEditar) return;
    setGuardando(true);
    setErrorGlobal(null);
    setMensajeExito(null);
    try {
      const payload: PoliticaCorreoAccesoDTO = {
        ...politica,
        politica_pasivos:
          politica.politica_pasivos === "alternativo" ? "institucional" : politica.politica_pasivos,
      };
      const res = await actualizarPoliticaCorreoAccesoAction(payload);
      if ("error" in res) {
        setErrorGlobal(res.error);
      } else {
        const guardada: PoliticaCorreoAccesoDTO = {
          ...res,
          politica_pasivos:
            res.politica_pasivos === "alternativo" ? "institucional" : res.politica_pasivos,
        };
        setPolitica(guardada);
        setPoliticaOriginal(guardada);
        setMensajeExito("Política de correo de acceso guardada correctamente.");
      }
    } catch {
      setErrorGlobal("Error inesperado al guardar la política.");
    } finally {
      setGuardando(false);
    }
  };

  const iniciarAsistenteLote = (grupo?: "activos" | "pasivos") => {
    if (grupo) setGrupoSeleccionado(grupo);
    setIncluirExcepciones(false);
    setVistaPrevia(null);
    setMotivoAplicacion("");
    setErrorMotivo(null);
    setPasoLote(1);
    setModalAbierta(true);
  };

  const irAPaso2VistaPrevia = async () => {
    setCargandoVistaPrevia(true);
    setPasoLote(2);
    try {
      const res = await obtenerVistaPreviaCorreoAccesoAction(grupoSeleccionado, incluirExcepciones);
      if ("error" in res) {
        setErrorGlobal(res.error);
      } else {
        setVistaPrevia(res);
      }
    } catch {
      setErrorGlobal("No fue posible calcular la vista previa.");
    } finally {
      setCargandoVistaPrevia(false);
    }
  };

  const irAPaso3Confirmacion = () => {
    setErrorMotivo(null);
    setPasoLote(3);
  };

  const handleDescargarExcel = async () => {
    setDescargandoExcel(true);
    try {
      const res = await descargarExcelVistaPreviaCorreoAccesoAction(
        grupoSeleccionado,
        incluirExcepciones,
      );
      if ("error" in res) {
        setErrorGlobal(res.error);
        return;
      }
      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      guardarArchivo(blob, res.nombre || `vista_previa_correo_${grupoSeleccionado}.xlsx`);
    } catch {
      setErrorGlobal("No fue posible descargar el reporte Excel.");
    } finally {
      setDescargandoExcel(false);
    }
  };

  const handleAplicarLote = async () => {
    const motivoLimpio = motivoAplicacion.trim();
    if (motivoLimpio.length < 5) {
      setErrorMotivo("El motivo es obligatorio y debe tener al menos 5 caracteres.");
      return;
    }
    setErrorMotivo(null);
    setAplicandoLote(true);
    try {
      const res = await aplicarPoliticaCorreoAccesoMasivoAction({
        grupo: grupoSeleccionado,
        motivo: motivoLimpio,
        incluir_excepciones: incluirExcepciones,
      });
      if ("error" in res) {
        setErrorMotivo(res.error);
      } else {
        setModalAbierta(false);
        if (res.asincrono) {
          setMensajeExito(
            `El lote de ${res.total} cuentas se procesará en segundo plano. El avance queda auditado por cuenta.`,
          );
        } else {
          const conflictos = res.conflictos ? `, ${res.conflictos} en conflicto` : "";
          setMensajeExito(
            `Aplicación en lote completada: ${res.actualizados} cuentas actualizadas, ${res.sin_cambio} sin cambios, ${res.sin_cuenta} sin cuenta${conflictos}.`,
          );
        }
      }
    } catch {
      setErrorMotivo("Error al ejecutar la aplicación masiva.");
    } finally {
      setAplicandoLote(false);
    }
  };

  if (!puedeVer) {
    return (
      <PageLayout
        title="Correo de acceso"
        description="Configuración de fuentes de correo y aplicación en lote."
      >
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            No tienes los permisos requeridos para consultar la configuración de correo de acceso.
          </AlertDescription>
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Correo de acceso"
      description="Políticas de resolución del correo de autenticación y aplicación masiva por grupo de trabajadores."
    >
      <div className="flex flex-col gap-6">
        {errorGlobal && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorGlobal}</AlertDescription>
          </Alert>
        )}

        {mensajeExito && (
          <Alert className="border-emerald-500 bg-emerald-50/50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-200">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <AlertTitle>Operación completada</AlertTitle>
            <AlertDescription>{mensajeExito}</AlertDescription>
          </Alert>
        )}

        {/* Sección 1: Activos y Pasivos lado a lado con la misma estructura */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tarjeta: Personal Activo */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Mail className="size-4 text-primary" />
                  Personal Activo
                </CardTitle>
                {politicaOriginal && (
                  <Badge variant="secondary" className="font-mono text-xs font-normal">
                    Vigente: {obtenerEtiquetaFuente(politicaOriginal.politica_activos)}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Fuente prioritaria para la cuenta de usuario de trabajadores activos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fuente-activos" className="text-xs font-medium">
                    Fuente de correo
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Información de ayuda"
                      >
                        <HelpCircle className="size-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" className="max-w-xs text-xs">
                      El correo institucional es la fuente recomendada. Si no posee correo institucional, se puede configurar correo alternativo o el de la ficha.
                    </PopoverContent>
                  </Popover>
                </div>
                <Select
                  value={politica.politica_activos}
                  onValueChange={(v) =>
                    setPolitica((prev) => ({ ...prev, politica_activos: v as PoliticaFuente }))
                  }
                  disabled={!puedeEditar || guardando || cargando}
                >
                  <SelectTrigger id="fuente-activos" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institucional">Institucional (Recomendado)</SelectItem>
                    <SelectItem value="alternativo">Alternativo</SelectItem>
                    <SelectItem value="correo_ficha">Correo de la ficha</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                Aplica a la asignación de cuentas durante la sincronización diaria y al registrar correos nuevos.
              </div>
            </CardContent>
          </Card>

          {/* Tarjeta: Personal Pasivo */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Mail className="size-4 text-primary" />
                  Personal Pasivo
                </CardTitle>
                {politicaOriginal && (
                  <Badge variant="secondary" className="font-mono text-xs font-normal">
                    Vigente: {obtenerEtiquetaFuente(politicaOriginal.politica_pasivos)}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Fuente prioritaria para jubilados, pensionados y sobrevivientes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fuente-pasivos" className="text-xs font-medium">
                    Fuente de correo
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Información de ayuda"
                      >
                        <HelpCircle className="size-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" className="max-w-xs text-xs">
                      El correo principal es el que inicia sesión. El alternativo se utiliza para contacto y notificación de constancias de fe de vida.
                    </PopoverContent>
                  </Popover>
                </div>
                <Select
                  value={
                    politica.politica_pasivos === "alternativo"
                      ? "institucional"
                      : politica.politica_pasivos
                  }
                  onValueChange={(v) =>
                    setPolitica((prev) => ({ ...prev, politica_pasivos: v as PoliticaFuente }))
                  }
                  disabled={!puedeEditar || guardando || cargando}
                >
                  <SelectTrigger id="fuente-pasivos" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institucional">Correo principal (Recomendado)</SelectItem>
                    <SelectItem value="correo_ficha">Correo de la ficha</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                La validación de la fe de vida no altera las credenciales a menos que se aplique una política en lote.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección 2: Configuración complementaria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Reglas generales de asignación</CardTitle>
            <CardDescription className="text-xs">
              Comportamiento del sistema ante datos incompletos y envíos de notificación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="si-falta" className="text-xs font-medium">
                    Si falta el correo elegido
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Información de ayuda"
                      >
                        <HelpCircle className="size-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" className="max-w-xs text-xs">
                      Si se selecciona dejar sin cuenta, el trabajador aparecerá en la lista de sincronización pendiente hasta que RRHH cargue su dirección.
                    </PopoverContent>
                  </Popover>
                </div>
                <Select
                  value={politica.si_falta_elegido}
                  onValueChange={(v) =>
                    setPolitica((prev) => ({ ...prev, si_falta_elegido: v as PoliticaFalta }))
                  }
                  disabled={!puedeEditar || guardando || cargando}
                >
                  <SelectTrigger id="si-falta" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dejar_sin_cuenta">
                      Dejar sin cuenta hasta que se cargue (Recomendado)
                    </SelectItem>
                    <SelectItem value="usar_siguiente">Usar el siguiente disponible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Label htmlFor="switch-avisar" className="text-xs font-medium">
                    Notificar al aplicar masivo
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Envía notificación de bienvenida o cambio al correo asignado durante lotes masivos.
                  </p>
                </div>
                <Switch
                  id="switch-avisar"
                  className="shrink-0"
                  checked={politica.avisar_al_aplicar_masivo}
                  onCheckedChange={(checked) =>
                    setPolitica((prev) => ({ ...prev, avisar_al_aplicar_masivo: checked }))
                  }
                  disabled={!puedeEditar || guardando || cargando}
                />
              </div>
            </div>

            {puedeEditar && (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleGuardarPolitica}
                  disabled={guardando || cargando}
                  className="w-full sm:w-auto"
                >
                  <Save className="mr-2 size-4" />
                  {guardando ? "Guardando..." : "Guardar políticas"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sección 3: Tarjeta de Aplicación en Lote */}
        <Card className="border-primary/20 bg-primary/[0.01]">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Users className="size-5 text-primary" />
                Aplicación en lote guiada
              </CardTitle>
              <CardDescription className="text-xs">
                Aplica la política de acceso de forma masiva a un grupo de trabajadores en 3 pasos auditados.
              </CardDescription>
            </div>
            {puedeEditar && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => iniciarAsistenteLote("pasivos")}
                  disabled={cargando}
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Lote para Pasivos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => iniciarAsistenteLote("activos")}
                  disabled={cargando}
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Lote para Activos
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-lg border bg-background p-3 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px]">
                    1
                  </span>
                  Elegir grupo
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Selecciona Activos o Pasivos e indica si deseas respetar o sobrescribir excepciones.
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px]">
                    2
                  </span>
                  Vista previa y Excel
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Revisa el impacto en pantalla y descarga el informe Excel oficial generado por el servidor.
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px]">
                    3
                  </span>
                  Confirmación auditada
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Ingresa el motivo justificado y confirma la actualización general con registro en bitácora.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Guiada de Aplicación en Lote (Pasos 1-2-3) */}
      <Dialog open={modalAbierta} onOpenChange={setModalAbierta}>
        <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-base font-semibold">
                Aplicación en lote: {grupoSeleccionado === "pasivos" ? "Personal Pasivo" : "Personal Activo"}
              </DialogTitle>
              {/* Stepper visual 1-2-3 */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={`flex size-6 items-center justify-center rounded-full font-semibold ${
                    pasoLote === 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  1
                </span>
                <span className="h-0.5 w-3 bg-muted" />
                <span
                  className={`flex size-6 items-center justify-center rounded-full font-semibold ${
                    pasoLote === 2
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  2
                </span>
                <span className="h-0.5 w-3 bg-muted" />
                <span
                  className={`flex size-6 items-center justify-center rounded-full font-semibold ${
                    pasoLote === 3
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  3
                </span>
              </div>
            </div>
            <DialogDescription className="text-xs">
              {pasoLote === 1 && "Paso 1: Selecciona la población objetivo y las reglas de excepción manual."}
              {pasoLote === 2 && "Paso 2: Inspecciona el resumen de cambios e impactos calculados."}
              {pasoLote === 3 && "Paso 3: Justifica la operación y aplica las modificaciones de manera irreversible."}
            </DialogDescription>
          </DialogHeader>

          {/* PASO 1: Selección de grupo y parámetros */}
          {pasoLote === 1 && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="modal-grupo" className="text-xs font-medium">
                  Grupo de trabajadores a procesar
                </Label>
                <Select
                  value={grupoSeleccionado}
                  onValueChange={(v) => setGrupoSeleccionado(v as "activos" | "pasivos")}
                >
                  <SelectTrigger id="modal-grupo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pasivos">Personal Pasivo (Jubilados / Pensionados)</SelectItem>
                    <SelectItem value="activos">Personal Activo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="modal-excepciones" className="text-xs font-medium">
                    Incluir excepciones manuales
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Si se activa, sobrescribe las cuentas configuradas individualmente desde Gestión del Sistema.
                  </p>
                </div>
                <Switch
                  id="modal-excepciones"
                  checked={incluirExcepciones}
                  onCheckedChange={setIncluirExcepciones}
                />
              </div>

              <Alert className="bg-muted/30">
                <HelpCircle className="size-4" />
                <AlertTitle className="text-xs">Información de la política a aplicar</AlertTitle>
                <AlertDescription className="text-[11px]">
                  Se evaluará la cuenta de cada trabajador contra la política de{" "}
                  <strong>
                    {grupoSeleccionado === "pasivos"
                      ? politica.politica_pasivos
                      : politica.politica_activos}
                  </strong>
                  . En el siguiente paso podrás revisar cada cuenta antes de alterar registros en base de datos.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* PASO 2: Vista previa con métricas, tabla y descarga Excel */}
          {pasoLote === 2 && (
            <div className="flex flex-col gap-4 overflow-hidden py-2">
              {cargandoVistaPrevia ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2">
                  <RefreshCw className="size-7 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Calculando vista previa oficial...</span>
                </div>
              ) : vistaPrevia ? (
                <>
                  {/* Tarjetas de métricas */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-center">
                    <div className="rounded-lg border p-2 bg-muted/40">
                      <div className="text-base font-bold">{vistaPrevia.total_evaluados}</div>
                      <div className="text-[11px] text-muted-foreground">Evaluados</div>
                    </div>
                    <div className="rounded-lg border p-2 bg-amber-50 dark:bg-amber-950/20">
                      <div className="text-base font-bold text-amber-600 dark:text-amber-400">
                        {vistaPrevia.cambian}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Cambiarán</div>
                    </div>
                    <div className="rounded-lg border p-2 bg-muted/40">
                      <div className="text-base font-bold">{vistaPrevia.quedan_igual}</div>
                      <div className="text-[11px] text-muted-foreground">Sin cambio</div>
                    </div>
                    <div className="rounded-lg border p-2 bg-destructive/10">
                      <div className="text-base font-bold text-destructive">
                        {vistaPrevia.quedan_sin_cuenta}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Sin cuenta</div>
                    </div>
                    <div className="rounded-lg border p-2 bg-muted/40 col-span-2 sm:col-span-1">
                      <div className="text-base font-bold">
                        {vistaPrevia.excepciones_manuales_ignoradas}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Excepciones</div>
                    </div>
                  </div>

                  {/* Barra de acción: Descarga Excel oficial */}
                  <div className="flex items-center justify-between border-y py-2">
                    <span className="text-xs text-muted-foreground">
                      Mostrando muestra representativa ({vistaPrevia.items.slice(0, 50).length} de {vistaPrevia.items.length})
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDescargarExcel}
                      disabled={descargandoExcel || !vistaPrevia.items.length}
                    >
                      <FileSpreadsheet className="mr-1.5 size-3.5 text-emerald-600 dark:text-emerald-400" />
                      {descargandoExcel ? "Generando..." : "Descargar Excel (.xlsx)"}
                    </Button>
                  </div>

                  {/* Tabla con scroll */}
                  <div className="max-h-52 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24 text-xs">Cédula</TableHead>
                          <TableHead className="text-xs">Nombre</TableHead>
                          <TableHead className="text-xs">Correo actual</TableHead>
                          <TableHead className="text-xs">Correo propuesto</TableHead>
                          <TableHead className="w-28 text-center text-xs">Resultado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vistaPrevia.items.slice(0, 50).map((it) => (
                          <TableRow key={it.cedula}>
                            <TableCell className="font-mono text-xs">{it.cedula}</TableCell>
                            <TableCell className="text-xs">{it.nombre_completo}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {it.correo_actual || "—"}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {it.correo_propuesto || "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              {it.es_excepcion_manual && !incluirExcepciones ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Excepción
                                </Badge>
                              ) : it.quedara_sin_cuenta ? (
                                <Badge variant="destructive" className="text-[10px]">
                                  Sin cuenta
                                </Badge>
                              ) : it.cambiara ? (
                                <Badge variant="default" className="text-[10px] bg-amber-600">
                                  Cambia
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Sin cambio
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* PASO 3: Justificación obligatoria y confirmación auditada */}
          {pasoLote === 3 && (
            <div className="space-y-4 py-4">
              <Alert className="border-amber-500 bg-amber-50/40 dark:border-amber-600 dark:bg-amber-950/20">
                <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Acción auditada con impacto en credenciales
                </AlertTitle>
                <AlertDescription className="text-[11px] text-amber-800 dark:text-amber-300">
                  Se actualizarán <strong>{vistaPrevia?.cambian ?? 0} cuentas</strong> de{" "}
                  {grupoSeleccionado === "pasivos" ? "personal pasivo" : "personal activo"}. Esta operación queda registrada en la bitácora del sistema con tu usuario.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="motivo-aplicacion" className="text-xs font-semibold">
                  Motivo obligatorio de la aplicación masiva *
                </Label>
                <Input
                  id="motivo-aplicacion"
                  value={motivoAplicacion}
                  onChange={(e) => {
                    setMotivoAplicacion(e.target.value);
                    if (errorMotivo) setErrorMotivo(null);
                  }}
                  placeholder="Ej.: Actualización según resolución institucional RRHH-2026 (mín. 5 car.)"
                  maxLength={250}
                  className={`text-xs ${errorMotivo ? "border-destructive" : ""}`}
                />
                {errorMotivo && (
                  <p className="text-xs text-destructive">{errorMotivo}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-2">
            <div>
              {pasoLote > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPasoLote((prev) => (prev === 3 ? 2 : 1))}
                  disabled={cargandoVistaPrevia || aplicandoLote}
                >
                  <ArrowLeft className="mr-1.5 size-3.5" />
                  Atrás
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalAbierta(false)}
                disabled={aplicandoLote}
              >
                Cancelar
              </Button>

              {pasoLote === 1 && (
                <Button size="sm" onClick={irAPaso2VistaPrevia} disabled={cargando}>
                  Siguiente: Vista previa
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              )}

              {pasoLote === 2 && (
                <Button
                  size="sm"
                  onClick={irAPaso3Confirmacion}
                  disabled={
                    cargandoVistaPrevia ||
                    !vistaPrevia ||
                    vistaPrevia.cambian === 0
                  }
                >
                  Siguiente: Confirmar
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              )}

              {pasoLote === 3 && (
                <Button
                  size="sm"
                  onClick={handleAplicarLote}
                  disabled={aplicandoLote || motivoAplicacion.trim().length < 5}
                >
                  {aplicandoLote ? (
                    <>
                      <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                      Aplicando lote...
                    </>
                  ) : (
                    "Confirmar y aplicar lote"
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

export default ConfiguracionCorreoAccesoPage;
