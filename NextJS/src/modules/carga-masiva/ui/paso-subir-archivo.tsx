"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet, X, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CargaMasivaResumen,
  ModoCarga,
  PoblacionCarga,
} from "../domain/entities/carga-masiva";

interface PropsPasoSubirArchivo {
  tiposSeleccionados: string[];
  modo: ModoCarga;
  poblacion: PoblacionCarga;
  onRetroceder: () => void;
  onCargaAnalizada: (resumen: CargaMasivaResumen) => void;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function PasoSubirArchivo({
  tiposSeleccionados,
  modo,
  poblacion,
  onRetroceder,
  onCargaAnalizada,
}: PropsPasoSubirArchivo) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validarArchivo = (file: File): boolean => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Formato inválido. Solo se admiten archivos Excel (.xlsx).");
      return false;
    }
    if (file.size > MAX_BYTES) {
      toast.error("El archivo supera el límite de 10 MB.");
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validarArchivo(file)) {
      setArchivo(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validarArchivo(file)) {
      setArchivo(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const analizarArchivo = async () => {
    if (!archivo) {
      toast.error("Seleccione un archivo .xlsx para analizar.");
      return;
    }

    setAnalizando(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("poblacion", poblacion);
      formData.append("tipos", tiposSeleccionados.join(","));
      formData.append("modo", modo);

      const response = await fetch("/api/carga-masiva/subir", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      const exitoso =
        response.ok &&
        data.status !== "error" &&
        data.status !== "fail" &&
        data.ok !== false;

      if (!exitoso) {
        throw new Error(data.message || data.error || "Error al analizar el archivo.");
      }

      toast.success("Archivo analizado exitosamente. Revise los resultados.");
      onCargaAnalizada(data.data ?? data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al subir y analizar");
    } finally {
      setAnalizando(false);
    }
  };

  const formatearTamano = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <UploadCloud className="size-5 text-primary" />
          Paso 2: Subida y Análisis Previos (Dry Run)
        </CardTitle>
        <CardDescription>
          Suba el archivo completado para validar integridad, formatos y coherencia con la base de datos sin alterar ningún registro.
          Población seleccionada: <strong className="text-foreground">{poblacion === "PASIVOS" ? "Pasivos" : "Activos"}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Zona de Drop */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
            dragOver
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <UploadCloud className="size-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Haga clic para seleccionar o arrastre el archivo aquí
              </p>
              <p className="text-xs text-muted-foreground">
                Solo hojas de cálculo Microsoft Excel (.xlsx) hasta 10 MB
              </p>
            </div>
          </div>
        </div>

        {/* Archivo Seleccionado */}
        {archivo && (
          <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{archivo.name}</p>
                <p className="text-xs text-muted-foreground">{formatearTamano(archivo.size)}</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setArchivo(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              disabled={analizando}
              className="text-muted-foreground hover:text-foreground size-8 p-0"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}

        {/* Botones de Navegación */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onRetroceder}
            disabled={analizando}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="size-4 mr-2" />
            Atrás (Plantilla)
          </Button>

          <Button
            onClick={analizarArchivo}
            disabled={!archivo || analizando}
            className="w-full sm:w-auto"
          >
            {analizando ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Analizando archivo...
              </>
            ) : (
              "Analizar Archivo"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
