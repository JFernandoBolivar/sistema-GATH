"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckSquare,
  Download,
  FileSpreadsheet,
  Info,
  Square,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ModoCarga,
  PoblacionCarga,
  tiposDePoblacion,
} from "../domain/entities/carga-masiva";

interface PropsPasoDescargarPlantilla {
  onAvanzar: (tiposSeleccionados: string[], modo: ModoCarga, poblacion: PoblacionCarga) => void;
  poblacionFija?: PoblacionCarga;
}

export function PasoDescargarPlantilla({ onAvanzar, poblacionFija }: PropsPasoDescargarPlantilla) {
  const [poblacion, setPoblacion] = useState<PoblacionCarga>(poblacionFija ?? "ACTIVOS");
  const tiposDisponibles = useMemo(() => tiposDePoblacion(poblacion), [poblacion]);
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>(
    tiposDisponibles.map((t) => t.clave),
  );
  const [modo, setModo] = useState<ModoCarga>("obligatorios");
  const [descargando, setDescargando] = useState(false);

  const cambiarPoblacion = (nueva: PoblacionCarga) => {
    setPoblacion(nueva);
    setTiposSeleccionados(tiposDePoblacion(nueva).map((t) => t.clave));
  };

  const toggleTipo = (clave: string) => {
    setTiposSeleccionados((prev) =>
      prev.includes(clave) ? prev.filter((t) => t !== clave) : [...prev, clave],
    );
  };

  const seleccionarTodos = () => {
    setTiposSeleccionados(tiposDisponibles.map((t) => t.clave));
  };

  const limpiarSeleccion = () => {
    setTiposSeleccionados([]);
  };

  const descargarPlantilla = async () => {
    if (tiposSeleccionados.length === 0) {
      toast.error("Debe seleccionar al menos un tipo de carga.");
      return;
    }

    setDescargando(true);
    try {
      const params = new URLSearchParams();
      params.append("poblacion", poblacion);
      params.append("tipos", tiposSeleccionados.join(","));
      params.append("modo", modo);

      const response = await fetch(`/api/carga-masiva/plantilla?${params.toString()}`);
      if (!response.ok) {
        throw new Error("No se pudo generar la plantilla.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plantilla-carga-masiva-${poblacion.toLowerCase()}-${modo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Plantilla descargada correctamente. Complete los datos y proceda al paso 2.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al descargar la plantilla");
    } finally {
      setDescargando(false);
    }
  };

  const nombrePoblacion = poblacion === "PASIVOS" ? "Pasivos" : "Activos";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-primary" />
                Paso 1: Población, Tipos y Plantilla
              </CardTitle>
              <CardDescription>
                Elija la población, los tipos de expediente y el modo de carga para generar la
                plantilla oficial en Excel.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={seleccionarTodos}
                className="text-xs h-8"
              >
                <CheckSquare className="size-3.5 mr-1" />
                Seleccionar todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={limpiarSeleccion}
                className="text-xs h-8"
              >
                <Square className="size-3.5 mr-1" />
                Limpiar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Población (obligatoria) */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Población a Cargar:</Label>
            {poblacionFija ? (
              <div className="rounded-lg border border-primary bg-primary/5 px-3 py-2 text-sm font-medium">
                {nombrePoblacion}
              </div>
            ) : (
              <RadioGroup
                value={poblacion}
                onValueChange={(val) => cambiarPoblacion(val as PoblacionCarga)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    poblacion === "ACTIVOS"
                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => cambiarPoblacion("ACTIVOS")}
                >
                  <RadioGroupItem value="ACTIVOS" id="poblacion-activos" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="poblacion-activos" className="font-medium cursor-pointer flex items-center gap-1.5">
                      <UserRound className="size-4" /> Activos
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Trabajadores con cargo vigente. Incluye «Cargo y asignación».
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    poblacion === "PASIVOS"
                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => cambiarPoblacion("PASIVOS")}
                >
                  <RadioGroupItem value="PASIVOS" id="poblacion-pasivos" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="poblacion-pasivos" className="font-medium cursor-pointer flex items-center gap-1.5">
                      <Users className="size-4" /> Pasivos
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Jubilados y pensionados. Sin «Cargo y asignación»; incluye datos del pase a pasivo.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            )}
          </div>

          {/* Tipos de carga */}
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-sm font-semibold">Tipos de Expediente a Cargar:</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tiposDisponibles.map((tipo) => {
                const checked = tiposSeleccionados.includes(tipo.clave);
                return (
                  <div
                    key={tipo.clave}
                    onClick={() => toggleTipo(tipo.clave)}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleTipo(tipo.clave)}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{tipo.nombre}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {tipo.descripcion}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modo de carga */}
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-sm font-semibold">Modo de Carga:</Label>
            <RadioGroup
              value={modo}
              onValueChange={(val) => setModo(val as ModoCarga)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <div
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  modo === "obligatorios"
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setModo("obligatorios")}
              >
                <RadioGroupItem value="obligatorios" id="modo-obligatorios" className="mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="modo-obligatorios" className="font-medium cursor-pointer">
                    Campos Obligatorios
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Genera las columnas mínimas indispensables para registrar trabajadores y sus asignaciones.
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  modo === "completo"
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setModo("completo")}
              >
                <RadioGroupItem value="completo" id="modo-completo" className="mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="modo-completo" className="font-medium cursor-pointer">
                    Expediente Completo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Incluye todas las columnas posibles (vivienda, salud, tallas, educación y antecedentes).
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Nota informativa institucional */}
          <div className="rounded-md bg-muted/60 p-3 flex items-start gap-2.5 text-xs text-muted-foreground border">
            <Info className="size-4 shrink-0 text-primary mt-0.5" />
            <p>
              La plantilla incluye una pestaña de <strong>Instrucciones</strong>, listas desplegables validadas contra
              los catálogos oficiales del sistema y una fila de ejemplo (fila 4). No modifique los encabezados de las columnas.
              El estatus no se escribe: los cambios de condición se registran con un movimiento confirmado.
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3">
            <Button
              onClick={descargarPlantilla}
              disabled={descargando || tiposSeleccionados.length === 0}
              className="w-full sm:w-auto"
            >
              <Download className="size-4 mr-2" />
              {descargando ? "Generando Excel..." : "Descargar Plantilla (.xlsx)"}
            </Button>

            <Button
              variant="outline"
              onClick={() => onAvanzar(tiposSeleccionados, modo, poblacion)}
              className="w-full sm:w-auto"
            >
              Ya tengo el archivo listo
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
