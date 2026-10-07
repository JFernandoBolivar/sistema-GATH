"use client";

/**
 * Campo de carga de una imagen posicionada del cintillo (logo izquierdo,
 * logo derecho o cintillo de pie). Reutiliza `FileUpload` (shared/ui,
 * drag-and-drop real) para la selección y añade preview visual de la
 * imagen (la ya configurada, o la recién seleccionada antes de subir).
 * La subida ocurre al seleccionar el archivo (sin botón "Guardar" aparte).
 */
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FileUpload } from "@/shared/ui/components/file-upload";

import type { CampoLogo } from "../../domain/ports/repo-configuracion-visual";
import { subirLogoConfiguracionAction } from "../../infrastructure/actions/configuracion-actions";

export function CampoLogoUpload({
  campo,
  etiqueta,
  urlActual,
  deshabilitado,
  onSubido,
}: {
  campo: CampoLogo;
  etiqueta: string;
  urlActual: string | null;
  deshabilitado?: boolean;
  onSubido: (nuevaUrl: string | null) => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!archivo) {
      setPreviewLocal(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setPreviewLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const manejarSeleccion = (file: File | null) => {
    setArchivo(file);
    if (!file) return;

    startTransition(async () => {
      const resultado = await subirLogoConfiguracionAction(campo, file);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error(resultado.error);
        setArchivo(null);
        return;
      }
      toast.success(`${etiqueta} actualizado correctamente.`);
      const nuevaUrl =
        campo === "logo_principal_clave"
          ? resultado.logoPrincipalUrl
          : campo === "logo_secundario_clave"
            ? resultado.logoSecundarioUrl
            : resultado.cintilloPieUrl;
      onSubido(nuevaUrl);
      setArchivo(null);
    });
  };

  const previewMostrado = previewLocal ?? urlActual;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{etiqueta}</p>
      {previewMostrado && (
        // eslint-disable-next-line @next/next/no-img-element -- preview de imagen remota/objeto local, no un asset de build
        <img
          src={previewMostrado}
          alt={`Vista previa de ${etiqueta}`}
          className="h-20 w-auto max-w-full rounded border border-border bg-muted object-contain p-1"
        />
      )}
      <div className={`relative ${deshabilitado ? "pointer-events-none opacity-50" : ""}`}>
        <FileUpload
          accept="image/png,image/jpeg,image/webp"
          label={isPending ? "Subiendo..." : `Reemplazar ${etiqueta.toLowerCase()}`}
          value={archivo}
          onChange={manejarSeleccion}
        />
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </div>
      {deshabilitado && (
        <p className="text-xs text-muted-foreground">
          Deshabilitado: el cintillo genérico es de solo lectura (RN-009-01). Seleccione "Fijo" para editar las imágenes.
        </p>
      )}
    </div>
  );
}
