"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ZonaSubidaProps {
  /** Se llama con el archivo elegido por clic, teclado o arrastrando y soltando. */
  onArchivo: (archivo: File) => void;
  /** Valor del atributo `accept` del input (tipos y extensiones admitidos). */
  accept: string;
  /** Texto principal de la zona. */
  titulo: string;
  /** Formatos y tamaño máximo. */
  detalle: string;
  /** Texto secundario sobre arrastrar y soltar. */
  ayuda?: string;
  /** Nombre accesible de la zona (botón). */
  etiquetaZona: string;
  /** Nombre accesible del input de archivo. */
  etiquetaInput?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Zona de carga de archivos reutilizable: arrastrar y soltar, clic o teclado (Enter/Espacio).
 * No valida ni sube: entrega el `File` a quien la usa.
 */
export function ZonaSubida({
  onArchivo,
  accept,
  titulo,
  detalle,
  ayuda = "o arrastra y suelta el archivo",
  etiquetaZona,
  etiquetaInput,
  disabled = false,
  className,
}: ZonaSubidaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  function abrir() {
    if (!disabled) inputRef.current?.click();
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={etiquetaZona}
      aria-disabled={disabled}
      onClick={abrir}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        if (disabled) return;
        const archivo = e.dataTransfer.files?.[0];
        if (archivo) onArchivo(archivo);
      }}
      className={cn(
        "mx-auto flex w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/20 px-4 py-8 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:px-6 sm:py-10",
        arrastrando && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <Upload className="size-10 text-muted-foreground" aria-hidden />
      <p className="text-base font-semibold">{titulo}</p>
      <p className="text-xs text-muted-foreground">{detalle}</p>
      <p className="text-sm text-muted-foreground">{ayuda}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-label={etiquetaInput}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) onArchivo(archivo);
          // Permite volver a elegir el mismo archivo tras quitarlo o corregirlo.
          e.target.value = "";
        }}
        className="sr-only"
      />
    </div>
  );
}

interface ArchivoElegidoProps {
  nombre: string;
  /** Texto de apoyo (p. ej. tamaño). */
  detalle?: string;
  onQuitar: () => void;
  disabled?: boolean;
  className?: string;
}

/** Archivo ya elegido: nombre (cortado si es largo) y botón para quitarlo. */
export function ArchivoElegido({
  nombre,
  detalle,
  onQuitar,
  disabled = false,
  className,
}: ArchivoElegidoProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border bg-muted/20 p-3", className)}>
      <FileText className="size-8 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium" title={nombre}>
          {nombre}
        </p>
        {detalle ? <p className="text-sm text-muted-foreground">{detalle}</p> : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        disabled={disabled}
        aria-label={`Quitar el archivo ${nombre}`}
        onClick={onQuitar}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
