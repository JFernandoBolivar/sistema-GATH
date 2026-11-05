"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Eye, FileText, Loader2, Plus, Save, Trash2 } from "lucide-react";
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
import {
  guardarConfiguracionPuntoCuentaAction,
  obtenerConfiguracionPuntoCuentaAction,
} from "@/modules/puntocuenta/infrastructure/actions/puntocuenta-actions";
import type {
  ConfiguracionPuntoCuenta,
  FirmaItem,
  ProcesosHabilitados,
} from "@/modules/puntocuenta/domain/entities/configuracion-punto-cuenta";
import { RUTA_CONFIGURACION } from "@/shared/lib/administracion-sistema";

const VARIABLES_DISPONIBLES = [
  { tag: "{nombre}", desc: "Nombre completo del trabajador" },
  { tag: "{cedula}", desc: "Cédula de identidad" },
  { tag: "{cargo}", desc: "Denominación del cargo / puesto" },
  { tag: "{origen}", desc: "Gerencia / Oficina de origen" },
  { tag: "{destino}", desc: "Gerencia / Oficina de destino" },
  { tag: "{fecha}", desc: "Fecha del movimiento" },
  { tag: "{motivo}", desc: "Motivo administrativo" },
  { tag: "{numero}", desc: "Número correlativo de punto de cuenta" },
];

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

  const [titulo, setTitulo] = useState("PUNTO DE CUENTA");
  const [encabezado, setEncabezado] = useState(
    "Para su conocimiento y fines pertinentes, se notifica el siguiente movimiento de personal:"
  );
  const [cuerpo, setCuerpo] = useState(
    "Por medio del presente punto de cuenta, se deja constancia del movimiento del funcionario {nombre}, titular de la cédula de identidad N.º {cedula}, en el cargo {cargo}. Movimiento desde {origen} hacia {destino}, con fecha {fecha} y motivo {motivo}, bajo el Punto de Cuenta N.º {numero}."
  );
  const [mostrarNivel, setMostrarNivel] = useState(true);
  const [firmas, setFirmas] = useState<FirmaItem[]>([
    { cargo: "Director(a) General de Gestión Humana", nombre: "" },
  ]);
  const [version, setVersion] = useState(1);

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

  const handleInsertarTag = (tag: string) => {
    setCuerpo((prev) => `${prev} ${tag}`);
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
      const payload: Partial<ConfiguracionPuntoCuenta> = {
        titulo,
        encabezado,
        cuerpo,
        firmas,
        mostrar_nivel: mostrarNivel,
      };

      const res = await fetch("/api/puntocuenta/vista-previa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("No fue posible generar la vista previa en PDF.");
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
    startTransition(async () => {
      const datos: Partial<ConfiguracionPuntoCuenta> = {
        generar,
        procesos_habilitados: procesos,
        titulo: titulo.trim(),
        encabezado,
        cuerpo,
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

  return (
    <PageLayout
      title="Configuración de Punto de Cuenta"
      description="Interruptor general, procesos administrativos que generan punto de cuenta y diseño del documento PDF."
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
            Versión de plantilla: v{version}
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
            <CardTitle className="text-base">Procesos que generan punto de cuenta</CardTitle>
            <CardDescription>
              Indique qué operaciones administrativas deben generar automáticamente un punto de cuenta cuando el interruptor general esté activado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm font-medium">Cambio de Gerencia / Oficina</Label>
                  <p className="text-xs text-muted-foreground">
                    Traslado o cambio de Dirección General (RN-006-01).
                  </p>
                </div>
                <Switch
                  checked={procesos.cambio_oficina}
                  onCheckedChange={() => handleProcesoToggle("cambio_oficina")}
                />
              </div>

              <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm font-medium">Cambio de Nivel</Label>
                  <p className="text-xs text-muted-foreground">
                    Cambio en el campo Nivel (Dependencia).
                  </p>
                </div>
                <Switch
                  checked={procesos.cambio_nivel}
                  onCheckedChange={() => handleProcesoToggle("cambio_nivel")}
                />
              </div>

              <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm font-medium">Cambio de División / Coordinación</Label>
                  <p className="text-xs text-muted-foreground">
                    Modificación de Dirección de Línea o Coordinación.
                  </p>
                </div>
                <Switch
                  checked={procesos.cambio_division}
                  onCheckedChange={() => handleProcesoToggle("cambio_division")}
                />
              </div>

              <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm font-medium">Cambio de cargo (misma oficina)</Label>
                  <p className="text-xs text-muted-foreground">
                    Cambio de denominación/puesto dentro de la misma oficina.
                  </p>
                </div>
                <Switch
                  checked={procesos.cambio_cargo_misma_oficina}
                  onCheckedChange={() => handleProcesoToggle("cambio_cargo_misma_oficina")}
                />
              </div>

              <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm font-medium">Egreso de personal activo</Label>
                  <p className="text-xs text-muted-foreground">
                    Desincorporación o egreso del trabajador.
                  </p>
                </div>
                <Switch
                  checked={procesos.egreso_activo}
                  onCheckedChange={() => handleProcesoToggle("egreso_activo")}
                />
              </div>

              <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm font-medium">Pase a pasivo</Label>
                  <p className="text-xs text-muted-foreground">
                    Pase a jubilado o pensionado de CONATEL.
                  </p>
                </div>
                <Switch
                  checked={procesos.pase_a_pasivo}
                  onCheckedChange={() => handleProcesoToggle("pase_a_pasivo")}
                />
              </div>

              <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm font-medium">Encargaduría / Préstamo de cargo</Label>
                  <p className="text-xs text-muted-foreground">
                    Asignación temporal de puesto en préstamo.
                  </p>
                </div>
                <Switch
                  checked={procesos.encargaduria_prestamo}
                  onCheckedChange={() => handleProcesoToggle("encargaduria_prestamo")}
                />
              </div>

              <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm font-medium">Cambio de estatus</Label>
                  <p className="text-xs text-muted-foreground">
                    Suspensión o modificación del estatus del puesto.
                  </p>
                </div>
                <Switch
                  checked={procesos.cambio_estatus}
                  onCheckedChange={() => handleProcesoToggle("cambio_estatus")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Formato del Documento PDF */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" aria-hidden /> Formato y contenido del PDF
            </CardTitle>
            <CardDescription>
              Personalice los textos del documento oficial. Utiliza el cintillo institucional de CONATEL y tipografía Arial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="titulo-doc" className="text-xs font-semibold">
                Título del documento
              </Label>
              <Input
                id="titulo-doc"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="PUNTO DE CUENTA"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="encabezado-doc" className="text-xs font-semibold">
                Texto de encabezado / introducción
              </Label>
              <Textarea
                id="encabezado-doc"
                value={encabezado}
                onChange={(e) => setEncabezado(e.target.value)}
                rows={2}
                className="mt-1 resize-y"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="cuerpo-doc" className="text-xs font-semibold">
                  Texto del cuerpo
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Haga clic en una variable para insertarla
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {VARIABLES_DISPONIBLES.map((v) => (
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
                id="cuerpo-doc"
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                rows={4}
                className="resize-y"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Mostrar Nivel administrativo</Label>
                <p className="text-xs text-muted-foreground">
                  Acompaña el nombre de la oficina con su nivel (ej. «Gerencia de Operaciones (Nivel Central)»).
                </p>
              </div>
              <Switch checked={mostrarNivel} onCheckedChange={setMostrarNivel} />
            </div>

            {/* Firmas */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Firmantes del documento</Label>
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
                    />
                    <Input
                      placeholder="Nombre (opcional)"
                      value={firma.nombre}
                      onChange={(e) => handleUpdateFirma(idx, "nombre", e.target.value)}
                      className="text-xs"
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
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleVistaPrevia}
            disabled={isPreviewPending}
            className="gap-1.5"
          >
            {isPreviewPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Eye className="size-4" />
            )}
            Vista previa en PDF
          </Button>

          <Button onClick={handleGuardar} disabled={isPending} className="gap-1.5">
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
