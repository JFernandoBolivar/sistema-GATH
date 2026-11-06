"use client";

/**
 * Pantalla de Configuración de Correo de Acceso y Aplicación Masiva (A7).
 * Permisos: configuracion.ver (lectura) y configuracion.editar (modificar).
 */
import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  Mail,
  RefreshCw,
  Save,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import type {
  PoliticaCorreoAccesoDTO,
  PoliticaFalta,
  PoliticaFuente,
  ResumenVistaPreviaDTO,
} from "../application/dtos/correo-acceso-dto";
import {
  actualizarPoliticaCorreoAccesoAction,
  aplicarPoliticaCorreoAccesoMasivoAction,
  obtenerPoliticaCorreoAccesoAction,
  obtenerVistaPreviaCorreoAccesoAction,
} from "../infrastructure/actions/correo-acceso-actions";

export function ConfiguracionCorreoAccesoPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVer = tienePermiso(permisos, "configuracion.ver");
  const puedeEditar = tienePermiso(permisos, "configuracion.editar");

  const [politica, setPolitica] = useState<PoliticaCorreoAccesoDTO>({
    politica_pasivos: "alternativo",
    politica_activos: "institucional",
    si_falta_elegido: "dejar_sin_cuenta",
    avisar_al_aplicar_masivo: false,
  });

  const [cargando, startTransition] = useTransition();
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  // Estado para la modal de vista previa y aplicación masiva
  const [modalAbierta, setModalAbierta] = useState(false);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<"activos" | "pasivos">("pasivos");
  const [incluirExcepciones, setIncluirExcepciones] = useState(false);
  const [cargandoVistaPrevia, setCargandoVistaPrevia] = useState(false);
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
      setPolitica(res);
    });
  }, [puedeVer]);

  const handleGuardarPolitica = async () => {
    if (!puedeEditar) return;
    setGuardando(true);
    setErrorGlobal(null);
    setMensajeExito(null);
    try {
      const res = await actualizarPoliticaCorreoAccesoAction(politica);
      if ("error" in res) {
        setErrorGlobal(res.error);
      } else {
        setPolitica(res);
        setMensajeExito("Política de correo de acceso guardada correctamente.");
      }
    } catch {
      setErrorGlobal("Error inesperado al guardar la política.");
    } finally {
      setGuardando(false);
    }
  };

  const handleAbrirVistaPrevia = async (grupo: "activos" | "pasivos") => {
    setGrupoSeleccionado(grupo);
    setIncluirExcepciones(false);
    setMotivoAplicacion("");
    setErrorMotivo(null);
    setModalAbierta(true);
    await cargarVistaPrevia(grupo, false);
  };

  const cargarVistaPrevia = async (grupo: "activos" | "pasivos", conExcepciones: boolean) => {
    setCargandoVistaPrevia(true);
    try {
      const res = await obtenerVistaPreviaCorreoAccesoAction(grupo, conExcepciones);
      if ("error" in res) {
        setErrorGlobal(res.error);
      } else {
        setVistaPrevia(res);
      }
    } catch {
      setErrorGlobal("No fue posible cargar la vista previa.");
    } finally {
      setCargandoVistaPrevia(false);
    }
  };

  const handleToggleIncluirExcepciones = async (checked: boolean) => {
    setIncluirExcepciones(checked);
    await cargarVistaPrevia(grupoSeleccionado, checked);
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
            `Aplicación masiva exitosa: ${res.actualizados} cuentas actualizadas, ${res.sin_cambio} sin cambios, ${res.sin_cuenta} sin cuenta${conflictos}.`,
          );
        }
      }
    } catch {
      setErrorMotivo("Error al ejecutar la aplicación masiva.");
    } finally {
      setAplicandoLote(false);
    }
  };

  const descargarCSVVistaPrevia = () => {
    if (!vistaPrevia || !vistaPrevia.items.length) return;
    const encabezados = [
      "Cedula",
      "Nombre",
      "Condicion",
      "Correo Actual",
      "Correo Propuesto",
      "Cambia",
      "Queda Sin Cuenta",
      "Excepcion Manual",
    ];
    const filas = vistaPrevia.items.map((it) => [
      `"${it.cedula}"`,
      `"${it.nombre_completo}"`,
      `"${it.condicion}"`,
      `"${it.correo_actual || ""}"`,
      `"${it.correo_propuesto || ""}"`,
      `"${it.cambiara ? "SI" : "NO"}"`,
      `"${it.quedara_sin_cuenta ? "SI" : "NO"}"`,
      `"${it.es_excepcion_manual ? "SI" : "NO"}"`,
    ]);
    const contenido = [encabezados.join(","), ...filas.map((f) => f.join(","))].join("\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `vista-previa-${grupoSeleccionado}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tarjeta: Política General */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-5" /> Correo de inicio de sesión
              </CardTitle>
              <CardDescription>
                Define con qué correo entran al sistema y reciben los avisos los activos y los pasivos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fuente-pasivos">Correo de acceso de PASIVOS</Label>
                <Select
                  value={politica.politica_pasivos}
                  onValueChange={(v) =>
                    setPolitica((prev) => ({ ...prev, politica_pasivos: v as PoliticaFuente }))
                  }
                  disabled={!puedeEditar || guardando || cargando}
                >
                  <SelectTrigger id="fuente-pasivos">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alternativo">Alternativo (Por defecto)</SelectItem>
                    <SelectItem value="institucional">Institucional</SelectItem>
                    <SelectItem value="correo_ficha">Correo de la ficha</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  El correo alternativo que el pasivo ya tiene registrado se usa de inmediato. Si lo
                  cambia o agrega en la fe de vida, el nuevo pasa a ser de acceso cuando Bienestar la
                  valida; si se rechaza o devuelve, sigue entrando con el anterior.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuente-activos">Correo de acceso de ACTIVOS</Label>
                <Select
                  value={politica.politica_activos}
                  onValueChange={(v) =>
                    setPolitica((prev) => ({ ...prev, politica_activos: v as PoliticaFuente }))
                  }
                  disabled={!puedeEditar || guardando || cargando}
                >
                  <SelectTrigger id="fuente-activos">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institucional">Institucional (Por defecto)</SelectItem>
                    <SelectItem value="alternativo">Alternativo</SelectItem>
                    <SelectItem value="correo_ficha">Correo de la ficha</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="si-falta">Si falta el correo elegido</Label>
                <Select
                  value={politica.si_falta_elegido}
                  onValueChange={(v) =>
                    setPolitica((prev) => ({ ...prev, si_falta_elegido: v as PoliticaFalta }))
                  }
                  disabled={!puedeEditar || guardando || cargando}
                >
                  <SelectTrigger id="si-falta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dejar_sin_cuenta">
                      Dejar sin cuenta hasta que se cargue (Por defecto)
                    </SelectItem>
                    <SelectItem value="usar_siguiente">Usar el siguiente disponible</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Si se deja sin cuenta, los pasivos pendientes se listan en el informe de sincronización.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 sm:gap-4 rounded-lg border p-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Label htmlFor="switch-avisar" className="text-sm font-medium">
                    Avisar por correo al aplicar masivo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Envía notificación de bienvenida/cambio al correo asignado durante lotes masivos.
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

              {puedeEditar && (
                <div className="pt-2">
                  <Button
                    onClick={handleGuardarPolitica}
                    disabled={guardando || cargando}
                    className="w-full sm:w-auto"
                  >
                    <Save className="mr-2 size-4" />
                    {guardando ? "Guardando..." : "Guardar política"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tarjeta: Aplicación Masiva */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" /> Aplicación en lote
              </CardTitle>
              <CardDescription>
                Aplica la política de acceso de forma masiva a un grupo de trabajadores con vista previa previa y confirmación auditada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pasivos" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pasivos">Personal Pasivo</TabsTrigger>
                  <TabsTrigger value="activos">Personal Activo</TabsTrigger>
                </TabsList>

                <TabsContent value="pasivos" className="mt-4 space-y-4">
                  <Alert>
                    <Info className="size-4" />
                    <AlertTitle>Grupo Pasivos</AlertTitle>
                    <AlertDescription className="text-xs">
                      Resuelve el correo para jubilados, pensionados y sobrevivientes según la política{" "}
                      <strong>{politica.politica_pasivos}</strong>. Respeta excepciones configuradas manualmente en usuarios.
                    </AlertDescription>
                  </Alert>
                  {puedeEditar && (
                    <Button
                      onClick={() => handleAbrirVistaPrevia("pasivos")}
                      disabled={cargando}
                      className="w-full sm:w-auto"
                    >
                      <RefreshCw className="mr-2 size-4" />
                      Vista previa y aplicar a Pasivos
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="activos" className="mt-4 space-y-4">
                  <Alert>
                    <Info className="size-4" />
                    <AlertTitle>Grupo Activos</AlertTitle>
                    <AlertDescription className="text-xs">
                      Resuelve el correo para trabajadores activos según la política{" "}
                      <strong>{politica.politica_activos}</strong>.
                    </AlertDescription>
                  </Alert>
                  {puedeEditar && (
                    <Button
                      onClick={() => handleAbrirVistaPrevia("activos")}
                      disabled={cargando}
                      className="w-full sm:w-auto"
                    >
                      <RefreshCw className="mr-2 size-4" />
                      Vista previa y aplicar a Activos
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal: Vista Previa y Confirmación de Aplicación Masiva */}
      <Dialog open={modalAbierta} onOpenChange={setModalAbierta}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Vista previa: Aplicación masiva a {grupoSeleccionado === "pasivos" ? "Pasivos" : "Activos"}
            </DialogTitle>
            <DialogDescription>
              Revisa los cambios que se aplicarán en el correo de acceso antes de confirmar la operación.
            </DialogDescription>
          </DialogHeader>

          {cargandoVistaPrevia ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="size-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Calculando vista previa...</span>
            </div>
          ) : vistaPrevia ? (
            <div className="flex flex-col gap-4 overflow-hidden">
              {/* Métricas del resumen */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-center">
                <div className="rounded-lg border p-2 bg-muted/40">
                  <div className="text-lg font-bold">{vistaPrevia.total_evaluados}</div>
                  <div className="text-xs text-muted-foreground">Total evaluados</div>
                </div>
                <div className="rounded-lg border p-2 bg-amber-50 dark:bg-amber-950/20">
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {vistaPrevia.cambian}
                  </div>
                  <div className="text-xs text-muted-foreground">Cambiarán</div>
                </div>
                <div className="rounded-lg border p-2 bg-muted/40">
                  <div className="text-lg font-bold">{vistaPrevia.quedan_igual}</div>
                  <div className="text-xs text-muted-foreground">Quedan igual</div>
                </div>
                <div className="rounded-lg border p-2 bg-destructive/10">
                  <div className="text-lg font-bold text-destructive">
                    {vistaPrevia.quedan_sin_cuenta}
                  </div>
                  <div className="text-xs text-muted-foreground">Sin cuenta</div>
                </div>
                <div className="rounded-lg border p-2 bg-muted/40 col-span-2 sm:col-span-1">
                  <div className="text-lg font-bold">
                    {vistaPrevia.excepciones_manuales_ignoradas}
                  </div>
                  <div className="text-xs text-muted-foreground">Excepciones</div>
                </div>
              </div>

              {/* Opciones y descarga */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-y py-2">
                <div className="flex items-center gap-2.5">
                  <Switch
                    id="switch-excepciones"
                    className="shrink-0"
                    checked={incluirExcepciones}
                    onCheckedChange={handleToggleIncluirExcepciones}
                  />
                  <Label htmlFor="switch-excepciones" className="text-xs cursor-pointer leading-snug">
                    Incluir excepciones manuales (sobrescribir tarjetas individuales)
                  </Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={descargarCSVVistaPrevia}
                  disabled={!vistaPrevia.items.length}
                >
                  <Download className="mr-1 size-3.5" /> Descargar CSV
                </Button>
              </div>

              {/* Tabla de detalle */}
              <div className="max-h-60 overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Cédula</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Correo actual</TableHead>
                      <TableHead>Correo propuesto</TableHead>
                      <TableHead className="w-28 text-center">Estado</TableHead>
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
              {vistaPrevia.items.length > 50 && (
                <p className="text-xs text-muted-foreground text-center">
                  Mostrando las primeras 50 filas de {vistaPrevia.items.length}. Descarga el CSV para ver la lista completa.
                </p>
              )}

              {/* Formulario de confirmación con motivo */}
              <div className="space-y-1.5 pt-2">
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
                  placeholder="Explica la razón del cambio en lote (mínimo 5 caracteres)"
                  maxLength={250}
                  className={errorMotivo ? "border-destructive" : ""}
                />
                {errorMotivo && (
                  <p className="text-xs text-destructive">{errorMotivo}</p>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setModalAbierta(false)}
              disabled={aplicandoLote}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAplicarLote}
              disabled={
                aplicandoLote ||
                cargandoVistaPrevia ||
                !vistaPrevia ||
                vistaPrevia.cambian === 0
              }
            >
              {aplicandoLote ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  Aplicando lote...
                </>
              ) : (
                "Confirmar y aplicar cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
export default ConfiguracionCorreoAccesoPage;
