"use client";

/**
 * Campo de carga de una imagen posicionada del cintillo (logo izquierdo,
 * logo derecho o cintillo de pie). Reutiliza `FileUpload` (shared/ui,
 * drag-and-drop real) para la selección y añade preview visual de la
 * imagen (la ya configurada, o la recién seleccionada antes de subir).
 * La subida ocurre al seleccionar el archivo (sin botón "Guardar" aparte).
 */
import { useEffect, useState, useTransition } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FileUpload } from "@/shared/ui/components/file-upload";
import { Badge } from "@/components/ui/badge";

import type { ConfiguracionVisualDTO } from "../../application/dtos/configuracion-visual-dto";
import type { CampoLogo } from "../../domain/ports/repo-configuracion-visual";
import { subirLogoConfiguracionAction } from "../../infrastructure/actions/configuracion-actions";
import { VersionesImagenDialog } from "./versiones-imagen-dialog";

function urlDeCampo(campo: CampoLogo, config: ConfiguracionVisualDTO): string | null {
  if (campo === "logo_principal_clave") return config.logoPrincipalUrl;
  if (campo === "logo_secundario_clave") return config.logoSecundarioUrl;
  return config.cintilloPieUrl;
}

export function CampoLogoUpload({
  campo,
  etiqueta,
  descripcion,
  urlActual,
  deshabilitado,
  onSubido,
}: {
  campo: CampoLogo;
  etiqueta: string;
  descripcion?: string;
  urlActual: string | null;
  deshabilitado?: boolean;
  onSubido: (nuevaUrl: string | null) => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!archivo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewLocal(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setPreviewLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const manejarSeleccion = (file: File | null) => {
    setError(null);
    setArchivo(file);
    if (!file) return;

    startTransition(async () => {
      const resultado = await subirLogoConfiguracionAction(campo, file);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const err = resultado as { error: string; errores?: Record<string, string[]> };
        setError(err.errores?.archivo?.[0] ?? err.error);
        setArchivo(null);
        return;
      }
      toast.success(`${etiqueta} actualizado correctamente.`);
      onSubido(urlDeCampo(campo, resultado));
      setRevision((r) => r + 1);
      setArchivo(null);
    });
  };

  const urlConRevision = urlActual && revision > 0 ? `${urlActual}${urlActual.includes("?") ? "&" : "?"}v=${revision}` : urlActual;
  const previewMostrado = previewLocal ?? urlConRevision;

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4 rounded-xl border border-border bg-card/60 shadow-xs hover:border-border/80 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{etiqueta}</p>
          {descripcion && <p className="text-xs text-muted-foreground mt-0.5">{descripcion}</p>}
        </div>
        {previewMostrado ? (
          <Badge variant="secondary" className="text-[10px] font-medium shrink-0">
            Vigente
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
            Predeterminado
          </Badge>
        )}
      </div>

      {/* Caja de previsualización con fondo damero o neutro para transparentes */}
      <div className="relative flex h-28 w-full items-center justify-center rounded-lg border border-border/80 bg-muted/40 p-2 overflow-hidden">
        {previewMostrado ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview de imagen remota/objeto local, no un asset de build
          <img
            src={previewMostrado}
            alt={`Vista previa de ${etiqueta}`}
            className="h-full w-full object-contain filter drop-shadow-xs transition-transform duration-200 hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <ImageIcon className="size-8 opacity-40" aria-hidden />
            <span className="text-[11px]">Asset oficial de respaldo</span>
          </div>
        )}
      </div>

      {/* Zona de carga y drag-and-drop */}
      <div className={`relative ${deshabilitado ? "pointer-events-none opacity-50" : ""}`}>
        <FileUpload
          accept="image/png,image/jpeg,image/webp"
          label={isPending ? "Subiendo..." : `Subir o reemplazar imagen`}
          value={archivo}
          onChange={manejarSeleccion}
        />
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/80 backdrop-blur-xs">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}

      {/* Botón de historial de versiones */}
      <div className="pt-1 flex items-center justify-between">
        <VersionesImagenDialog
          campo={campo}
          etiqueta={etiqueta}
          deshabilitado={deshabilitado}
          recarga={revision}
          onRestaurada={(cfg) => {
            onSubido(urlDeCampo(campo, cfg));
            setRevision((r) => r + 1);
          }}
        />
      </div>

      {deshabilitado && (
        <p className="text-[11px] text-muted-foreground/80 italic">
          Solo lectura en modo Genérico. Seleccione &quot;Institucional (Fijo)&quot; para personalizar.
        </p>
      )}
    </div>
  );
}
