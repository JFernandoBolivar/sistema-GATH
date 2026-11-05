"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, Eye, FileText, Info, Loader2, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  guardarConfiguracionPuntoCuentaAction,
  obtenerConfiguracionPuntoCuentaAction,
} from "@/modules/puntocuenta/infrastructure/actions/puntocuenta-actions";
import {
  type ConfiguracionPuntoCuenta,
  type FirmaItem,
  type PlantillaProceso,
  type ProcesosHabilitados,
  type VariableDisponible,
  PROCESOS_METADATA,
  VARIABLES_FALLBACK,
  validarVariablesTexto,
} from "@/modules/puntocuenta/domain/entities/configuracion-punto-cuenta";
import { RUTA_CONFIGURACION } from "@/shared/lib/administracion-sistema";

const PLANTILLA_GENERAL_KEY = "general";

const PROCESOS_CLAVES = Object.keys(PROCESOS_METADATA) as (keyof ProcesosHabilitados)[];

export function ConfiguracionPuntoCuentaPage() {
  const [isPending, startTransition] = useTransition();
  const [isPreviewPending, setIsPreviewPending] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Estados del formulario
  const [generar, setGenerar] = useState(false);
  const [procesos, setProcesos] = useState<ProcesosHabilitados>({
    cambio_oficina: true,
    cambio_nivel: false,
    cambio_division: false,
    cambio_cargo_misma_oficina: false,
    egreso_activo: false,
    pase_a_pasivo: false,
    encargaduria_prestamo: false,
    cambio_estatus: false,
  });

  // Plantilla General
  const [titulo, setTitulo] = useState("PUNTO DE CUENTA");
  const [encabezado, setEncabezado] = useState(
    "Para su conocimiento y fines pertinentes, se notifica el siguiente movimiento de personal:"
  );
  const [cuerpo, setCuerpo] = useState(
    "Por medio del presente punto de cuenta, se deja constancia del movimiento del funcionario {nombre}, titular de la cédula de identidad N.º {cedula}, en el cargo {cargo}. Movimiento desde {origen} hacia {destino}, con fecha {fecha} y motivo {motivo}, bajo el Punto de Cuenta N.º {numero}."
  );

  // Plantillas por Proceso
  const [plantillasProcesos, setPlantillasProcesos] = useState<Record<string, PlantillaProceso>>({});
  const [tabActiva, setTabActiva] = useState<string>(PLANTILLA_GENERAL_KEY);

  // Formato compartido y firmas
  const [mostrarNivel, setMostrarNivel] = useState(true);
  const [firmas, setFirmas] = useState<FirmaItem[]>([
    { cargo: "Director(a) General de Gestión Humana", nombre: "" },
  ]);
  const [version, setVersion] = useState(1);
  const [variablesDisponibles, setVariablesDisponibles] = useState<VariableDisponible[]>(VARIABLES_FALLBACK);

  const tagsPermitidosSet = useMemo(
    () => new Set(variablesDisponibles.map((v) => v.tag)),
    [variablesDisponibles]
  );

  useEffect(() => {
    (async () => {
      setCargando(true);
      const res = await obtenerConfiguracionPuntoCuentaAction();
      if (res.success && res.data) {
        setGenerar(Boolean(res.data.generar));
        if (res.data.procesos_habilitados) {
          setProcesos(res.data.procesos_habilitados);
        }
        if (res.data.titulo) setTitulo(res.data.titulo);
        if (res.data.encabezado !== undefined) setEncabezado(res.data.encabezado);
        if (res.data.cuerpo !== undefined) setCuerpo(res.data.cuerpo);
        if (res.data.plantillas_procesos) setPlantillasProcesos(res.data.plantillas_procesos);
        if (res.data.variables_disponibles && res.data.variables_disponibles.length > 0) {
          setVariablesDisponibles(res.data.variables_disponibles);
        }
        if (res.data.mostrar_nivel !== undefined) setMostrarNivel(res.data.mostrar_nivel);
        if (res.data.firmas && res.data.firmas.length > 0) setFirmas(res.data.firmas);
        if (res.data.version) setVersion(res.data.version);
      } else {
        toast.error("No fue posible cargar la configuración actual");
      }
      setCargando(false);
    })();
  }, []);

  const handleProcesoToggle = (clave: keyof ProcesosHabilitados) => {
    setProcesos((prev) => ({
      ...prev,
      [clave]: !prev[clave],
    }));
  };

  const plantillaActual = useMemo(() => {
    if (tabActiva === PLANTILLA_GENERAL_KEY) {
      return {
        personalizado: true,
        titulo,
        encabezado,
        cuerpo,
      };
    }
    const proc = plantillasProcesos[tabActiva];
    return {
      personalizado: Boolean(proc?.personalizado),
      titulo: proc?.titulo || "",
      encabezado: proc?.encabezado || "",
      cuerpo: proc?.cuerpo || "",
    };
  }, [tabActiva, titulo, encabezado, cuerpo, plantillasProcesos]);

  const erroresVariablesActuales = useMemo(() => {
    const errTitulo = validarVariablesTexto(plantillaActual.titulo, tagsPermitidosSet);
    const errEncabezado = validarVariablesTexto(plantillaActual.encabezado, tagsPermitidosSet);
    const errCuerpo = validarVariablesTexto(plantillaActual.cuerpo, tagsPermitidosSet);
    const todas = Array.from(new Set([...errTitulo, ...errEncabezado, ...errCuerpo]));
    return todas;
  }, [plantillaActual, tagsPermitidosSet]);

  const handleUpdatePlantillaActual = (campo: "titulo" | "encabezado" | "cuerpo", valor: string) => {
    if (tabActiva === PLANTILLA_GENERAL_KEY) {
      if (campo === "titulo") setTitulo(valor);
      if (campo === "encabezado") setEncabezado(valor);
      if (campo === "cuerpo") setCuerpo(valor);
    } else {
      setPlantillasProcesos((prev) => {
        const actual = prev[tabActiva] || {
          personalizado: true,
          titulo: "",
          encabezado: "",
          cuerpo: "",
        };
        return {
          ...prev,
          [tabActiva]: {
            ...actual,
            [campo]: valor,
          },
        };
      });
    }
  };

  const handleTogglePersonalizado = (marcado: boolean) => {
    if (tabActiva === PLANTILLA_GENERAL_KEY) return;
    setPlantillasProcesos((prev) => {
      const actual = prev[tabActiva] || {
        personalizado: false,
        titulo: "",
        encabezado: "",
        cuerpo: "",
      };
      return {
        ...prev,
        [tabActiva]: {
          ...actual,
          personalizado: marcado,
          // Si activa por primera vez y está vacío, inicializar con los de la general
          titulo: marcado ? (actual.titulo || titulo) : actual.titulo,
          encabezado: marcado ? (actual.encabezado || encabezado) : actual.encabezado,
          cuerpo: marcado ? (actual.cuerpo || cuerpo) : actual.cuerpo,
        },
      };
    });
  };

  const handleInsertarTag = (tag: string) => {
    if (tabActiva === PLANTILLA_GENERAL_KEY) {
      setCuerpo((prev) => (prev ? `${prev} ${tag}` : tag));
    } else {
      setPlantillasProcesos((prev) => {
        const actual = prev[tabActiva] || {
          personalizado: true,
          titulo: "",
          encabezado: "",
          cuerpo: "",
        };
        const nuevoCuerpo = actual.cuerpo ? `${actual.cuerpo} ${tag}` : tag;
        return {
          ...prev,
          [tabActiva]: {
            ...actual,
            cuerpo: nuevoCuerpo,
          },
        };
      });
    }
  };

  const handleAddFirma = () => {
    setFirmas((prev) => [...prev, { cargo: "", nombre: "" }]);
  };

  const handleRemoveFirma = (index: number) => {
    setFirmas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateFirma = (index: number, campo: keyof FirmaItem, valor: string) => {
    setFirmas((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [campo]: valor } : f))
    );
  };

  const handleVistaPrevia = async () => {
    setIsPreviewPending(true);
    try {
      let previewTitulo = titulo;
      let previewEncabezado = encabezado;
      let previewCuerpo = cuerpo;
      let procesoParam: string | undefined = undefined;

      if (tabActiva !== PLANTILLA_GENERAL_KEY) {
        procesoParam = tabActiva;
        const proc = plantillasProcesos[tabActiva];
        if (proc && proc.personalizado) {
          previewTitulo = proc.titulo.trim() || titulo;
          previewEncabezado = proc.encabezado || encabezado;
          previewCuerpo = proc.cuerpo || cuerpo;
        }
      }

      const payload = {
        titulo: previewTitulo,
        encabezado: previewEncabezado,
        cuerpo: previewCuerpo,
        firmas,
        mostrar_nivel: mostrarNivel,
        proceso: procesoParam,
        plantillas_procesos: plantillasProcesos,
      };

      const res = await fetch("/api/puntocuenta/vista-previa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "No fue posible generar la vista previa en PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al generar la vista previa");
    } finally {
      setIsPreviewPending(false);
    }
  };

  const handleGuardar = () => {
    // Validar variables de la plantilla general
    const errGen = [
      ...validarVariablesTexto(titulo, tagsPermitidosSet),
      ...validarVariablesTexto(encabezado, tagsPermitidosSet),
      ...validarVariablesTexto(cuerpo, tagsPermitidosSet),
    ];
    if (errGen.length > 0) {
      toast.error(`La plantilla general contiene variables no válidas: ${errGen.join(", ")}`);
      return;
    }

    // Validar variables de cada plantilla personalizada
    for (const [procKey, plantilla] of Object.entries(plantillasProcesos)) {
      if (plantilla.personalizado) {
        const errProc = [
          ...validarVariablesTexto(plantilla.titulo, tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.encabezado, tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.cuerpo, tagsPermitidosSet),
        ];
        if (errProc.length > 0) {
          const meta = PROCESOS_METADATA[procKey as keyof ProcesosHabilitados];
          toast.error(
            `La plantilla de "${meta?.titulo || procKey}" contiene variables no válidas: ${errProc.join(", ")}`
          );
          return;
        }
      }
    }

    startTransition(async () => {
      const datos: Partial<ConfiguracionPuntoCuenta> = {
        generar,
        procesos_habilitados: procesos,
        titulo: titulo.trim(),
        encabezado,
        cuerpo,
        plantillas_procesos: plantillasProcesos,
        firmas,
        mostrar_nivel: mostrarNivel,
      };

      const res = await guardarConfiguracionPuntoCuentaAction(datos);
      if (res.success && res.data) {
        toast.success(`Configuración guardada correctamente (Versión ${res.data.version}).`);
        setVersion(res.data.version);
      } else {
        toast.error(res.error || "Error al guardar la configuración");
      }
    });
  };

  if (cargando) {
    return (
      <PageLayout title="Configuración de Punto de Cuenta" description="Cargando configuración...">
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <Loader2 className="size-8 animate-spin mr-2 text-primary" />
          Cargando configuración...
        </div>
      </PageLayout>
    );
  }

  // Filtrar solo los procesos habilitados para las pestañas
  const procesosHabilitadosParaPlantilla = PROCESOS_CLAVES.filter((k) => Boolean(procesos[k]));

  return (
    <PageLayout
      title="Configuración de Punto de Cuenta"
      description="Interruptor general, procesos administrativos que generan punto de cuenta y diseño de plantillas en PDF."
    >
      <div className="space-y-6 max-w-4xl">
        {/* Volver y Versión */}
        <div className="flex items-center justify-between">
          <Link
            href={RUTA_CONFIGURACION}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Volver a Configuración
          </Link>
          <Badge variant="outline" className="text-xs">
            Versión de configuración: v{version}
          </Badge>
        </div>

        {/* 1. Interruptor Maestro */}
        <Card className={generar ? "border-primary/50 bg-primary/5" : "border-muted"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Generación de puntos de cuenta</CardTitle>
                <CardDescription>
                  Interruptor general del sistema. Cuando está desactivado, ningún movimiento genera punto de cuenta ni se muestra el aviso de descarga.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {generar ? "Activo" : "Inactivo"}
                </span>
                <Switch
                  checked={generar}
                  onCheckedChange={setGenerar}
                  aria-label="Generar puntos de cuenta"
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 2. Procesos que generan Punto de Cuenta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimientos y procesos habilitados</CardTitle>
            <CardDescription>
              Indique qué operaciones administrativas generan automáticamente punto de cuenta. Cada movimiento habilitado puede personalizar su propia plantilla.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {PROCESOS_CLAVES.map((clave) => {
                const meta = PROCESOS_METADATA[clave];
                const estaHabilitado = Boolean(procesos[clave]);
                const tienePersonalizada = Boolean(plantillasProcesos[clave]?.personalizado);
                return (
                  <div
                    key={clave}
                    className={`flex items-start justify-between p-3 rounded-lg border transition-colors ${
                      estaHabilitado ? "bg-card border-border" : "bg-muted/30 border-muted text-muted-foreground"
                    }`}
                  >
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`proc-${clave}`} className="text-sm font-medium cursor-pointer">
                          {meta.titulo}
                        </Label>
                        {estaHabilitado && tienePersonalizada && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                            Personalizada
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{meta.descripcion}</p>
                    </div>
                    <Switch
                      id={`proc-${clave}`}
                      checked={estaHabilitado}
                      onCheckedChange={() => handleProcesoToggle(clave)}
                      aria-label={`Habilitar ${meta.titulo}`}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 3. Plantillas del Documento PDF */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" aria-hidden /> Plantillas del documento PDF
            </CardTitle>
            <CardDescription>
              Cada movimiento habilitado puede tener su propio título, encabezado y cuerpo. Si no se personaliza, se utiliza automáticamente la plantilla general predeterminada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Pestañas de plantillas */}
            <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-full">
              <div className="overflow-x-auto pb-1">
                <TabsList className="h-auto flex flex-wrap gap-1 bg-muted/60 p-1 justify-start">
                  <TabsTrigger value={PLANTILLA_GENERAL_KEY} className="text-xs">
                    Plantilla general
                  </TabsTrigger>
                  {procesosHabilitadosParaPlantilla.map((clave) => {
                    const meta = PROCESOS_METADATA[clave];
                    const esPersonalizado = Boolean(plantillasProcesos[clave]?.personalizado);
                    return (
                      <TabsTrigger key={clave} value={clave} className="text-xs gap-1.5">
                        <span>{meta.titulo}</span>
                        {esPersonalizado ? (
                          <span className="size-1.5 rounded-full bg-primary" aria-label="Personalizado" />
                        ) : null}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Contenido de Plantilla General */}
              <TabsContent value={PLANTILLA_GENERAL_KEY} className="space-y-4 pt-3">
                <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="size-4 mt-0.5 text-primary shrink-0" aria-hidden />
                  <p>
                    Esta es la <strong>plantilla general predeterminada</strong>. Los movimientos habilitados que no cuenten con una plantilla personalizada utilizarán estos mismos textos.
                  </p>
                </div>

                <div>
                  <Label htmlFor="titulo-general" className="text-xs font-semibold">
                    Título del documento
                  </Label>
                  <Input
                    id="titulo-general"
                    value={titulo}
                    onChange={(e) => handleUpdatePlantillaActual("titulo", e.target.value)}
                    placeholder="PUNTO DE CUENTA"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="encabezado-general" className="text-xs font-semibold">
                    Texto de encabezado / introducción
                  </Label>
                  <Textarea
                    id="encabezado-general"
                    value={encabezado}
                    onChange={(e) => handleUpdatePlantillaActual("encabezado", e.target.value)}
                    rows={2}
                    className="mt-1 resize-y"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="cuerpo-general" className="text-xs font-semibold">
                      Texto del cuerpo
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Haga clic en una variable para insertarla
                    </span>
                  </div>

                  {/* Variables disponibles */}
                  <div className="flex flex-wrap gap-1.5 mb-2" role="region" aria-label="Variables disponibles">
                    {variablesDisponibles.map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => handleInsertarTag(v.tag)}
                        title={v.desc}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-muted hover:bg-muted/80 text-foreground border transition-colors cursor-pointer"
                      >
                        {v.tag}
                      </button>
                    ))}
                  </div>

                  <Textarea
                    id="cuerpo-general"
                    value={cuerpo}
                    onChange={(e) => handleUpdatePlantillaActual("cuerpo", e.target.value)}
                    rows={4}
                    className="resize-y"
                  />
                </div>
              </TabsContent>

              {/* Contenido de cada Proceso Específico */}
              {procesosHabilitadosParaPlantilla.map((clave) => {
                const meta = PROCESOS_METADATA[clave];
                const procConfig = plantillasProcesos[clave];
                const esPersonalizado = Boolean(procConfig?.personalizado);

                return (
                  <TabsContent key={clave} value={clave} className="space-y-4 pt-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="space-y-0.5">
                        <Label htmlFor={`switch-custom-${clave}`} className="text-sm font-semibold">
                          Personalizar plantilla para {meta.titulo}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {esPersonalizado
                            ? "Plantilla exclusiva activa para este movimiento."
                            : "Actualmente hereda la plantilla general predeterminada."}
                        </p>
                      </div>
                      <Switch
                        id={`switch-custom-${clave}`}
                        checked={esPersonalizado}
                        onCheckedChange={handleTogglePersonalizado}
                        aria-label={`Personalizar plantilla para ${meta.titulo}`}
                      />
                    </div>

                    {!esPersonalizado ? (
                      <div className="space-y-3 opacity-60 pointer-events-none p-3 border rounded-lg bg-muted/10">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-muted-foreground" aria-hidden />
                          Usando plantilla general:
                        </p>
                        <div>
                          <Label className="text-xs">Título</Label>
                          <Input value={titulo} disabled className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Encabezado</Label>
                          <Textarea value={encabezado} disabled rows={2} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Cuerpo</Label>
                          <Textarea value={cuerpo} disabled rows={3} className="mt-1" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`titulo-${clave}`} className="text-xs font-semibold">
                            Título para {meta.titulo}
                          </Label>
                          <Input
                            id={`titulo-${clave}`}
                            value={procConfig?.titulo || ""}
                            onChange={(e) => handleUpdatePlantillaActual("titulo", e.target.value)}
                            placeholder={`PUNTO DE CUENTA - ${meta.titulo.toUpperCase()}`}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`encabezado-${clave}`} className="text-xs font-semibold">
                            Texto de encabezado / introducción
                          </Label>
                          <Textarea
                            id={`encabezado-${clave}`}
                            value={procConfig?.encabezado || ""}
                            onChange={(e) => handleUpdatePlantillaActual("encabezado", e.target.value)}
                            placeholder={encabezado}
                            rows={2}
                            className="mt-1 resize-y"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label htmlFor={`cuerpo-${clave}`} className="text-xs font-semibold">
                              Texto del cuerpo para este movimiento
                            </Label>
                            <span className="text-[11px] text-muted-foreground">
                              Haga clic en una variable para insertarla
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-2" role="region" aria-label="Variables disponibles">
                            {variablesDisponibles.map((v) => (
                              <button
                                key={v.tag}
                                type="button"
                                onClick={() => handleInsertarTag(v.tag)}
                                title={v.desc}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-muted hover:bg-muted/80 text-foreground border transition-colors cursor-pointer"
                              >
                                {v.tag}
                              </button>
                            ))}
                          </div>

                          <Textarea
                            id={`cuerpo-${clave}`}
                            value={procConfig?.cuerpo || ""}
                            onChange={(e) => handleUpdatePlantillaActual("cuerpo", e.target.value)}
                            placeholder={cuerpo}
                            rows={4}
                            className="resize-y"
                          />
                        </div>
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>

            {/* Alerta de variables no válidas si existen en la plantilla activa */}
            {erroresVariablesActuales.length > 0 && (
              <div role="alert" className="p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-xs space-y-1">
                <p className="font-semibold">Variables no reconocidas en el texto:</p>
                <p>
                  {erroresVariablesActuales.join(", ")} no son variables válidas. Las variables permitidas son:{" "}
                  {variablesDisponibles.map((v) => v.tag).join(", ")}.
                </p>
              </div>
            )}

            {/* Ajustes de nivel y firmas (comunes) */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="switch-nivel" className="text-sm font-medium">Mostrar Nivel administrativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Acompaña el nombre de la oficina con su nivel (ej. «Gerencia de Operaciones (Nivel Central)»).
                  </p>
                </div>
                <Switch id="switch-nivel" checked={mostrarNivel} onCheckedChange={setMostrarNivel} />
              </div>

              {/* Firmas comunes */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Firmantes del documento (común para todas las plantillas)</Label>
                    <p className="text-xs text-muted-foreground">
                      Cargos y nombres que firman al pie del punto de cuenta.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddFirma}
                    className="gap-1 text-xs"
                  >
                    <Plus className="size-3.5" /> Añadir firmante
                  </Button>
                </div>

                <div className="space-y-2">
                  {firmas.map((firma, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="Cargo (ej. Director General de Gestión Humana)"
                        value={firma.cargo}
                        onChange={(e) => handleUpdateFirma(idx, "cargo", e.target.value)}
                        className="text-xs"
                        aria-label={`Cargo del firmante ${idx + 1}`}
                      />
                      <Input
                        placeholder="Nombre (opcional)"
                        value={firma.nombre}
                        onChange={(e) => handleUpdateFirma(idx, "nombre", e.target.value)}
                        className="text-xs"
                        aria-label={`Nombre del firmante ${idx + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFirma(idx)}
                        disabled={firmas.length <= 1}
                        title="Quitar firma"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleVistaPrevia}
            disabled={isPreviewPending || erroresVariablesActuales.length > 0}
            className="gap-1.5"
          >
            {isPreviewPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Eye className="size-4" />
            )}
            Vista previa ({tabActiva === PLANTILLA_GENERAL_KEY ? "General" : PROCESOS_METADATA[tabActiva as keyof ProcesosHabilitados]?.titulo || tabActiva})
          </Button>

          <Button
            onClick={handleGuardar}
            disabled={isPending || erroresVariablesActuales.length > 0}
            className="gap-1.5"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Guardar configuración
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
