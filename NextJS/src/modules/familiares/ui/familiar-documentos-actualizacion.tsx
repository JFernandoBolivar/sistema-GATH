"use client";

/**
 * Documentos del familiar dentro del diálogo de edición:
 * lista los documentos cargados (tipo, nombre y fecha), permite verlos con el
 * proxy autenticado del backend (`familiares/<id>/documentos/<id>/archivo/`),
 * reemplazar el archivo de uno existente y agregar otro documento.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { FileDown, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { formatearFecha } from "@/shared/lib/formato-fecha";
import { Button } from "@/shared/ui/components/button";
import { FileUpload } from "@/shared/ui/components/file-upload";

import type { DocumentoFamiliarDTO, TipoDocumentoFamiliar } from "../application/dtos/familiar-dto";
import {
  getDocumentosFamiliarAction,
  reemplazarDocumentoFamiliarAction,
  subirDocumentoFamiliarAction,
} from "../infrastructure/actions/familiares-actions";
import { etiquetaDocumento } from "./detalle-familiar-view-model";

const TIPOS: TipoDocumentoFamiliar[] = ["cedula", "partida_nacimiento"];

export function FamiliarDocumentosActualizacion({ familiarId }: { familiarId: number }) {
  const [documentos, setDocumentos] = useState<DocumentoFamiliarDTO[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipoNuevo, setTipoNuevo] = useState<TipoDocumentoFamiliar>("cedula");
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const [reemplazando, setReemplazando] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputReemplazo = useRef<HTMLInputElement | null>(null);
  const documentoAReemplazar = useRef<number | null>(null);

  const cargar = () => {
    setCargando(true);
    setError(null);
    getDocumentosFamiliarAction(familiarId)
      .then((resultado) => {
        if (resultado && typeof resultado === "object" && "error" in resultado) {
          setError((resultado as { error: string }).error);
          return;
        }
        const lista = (resultado as DocumentoFamiliarDTO[]) ?? [];
        setDocumentos(lista.filter((d) => d.familiarId === undefined || d.familiarId === familiarId));
      })
      .catch(() => setError("No fue posible cargar los documentos."))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    setDocumentos(null);
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiarId]);

  const onReemplazar = (documentoId: number, archivo: File | null) => {
    if (!archivo) return;
    const id = documentoId;
    setReemplazando(id);
    startTransition(async () => {
      const resultado = await reemplazarDocumentoFamiliarAction(familiarId, id, archivo);
      setReemplazando(null);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error || "No fue posible reemplazar el documento.");
        return;
      }
      toast.success("Documento reemplazado exitosamente");
      cargar();
    });
  };

  const onAgregar = () => {
    if (!archivoNuevo) return;
    const reemplazaAhora = documentos?.some((d) => d.tipoDocumento === tipoNuevo) ?? false;
    startTransition(async () => {
      const resultado = await subirDocumentoFamiliarAction(familiarId, tipoNuevo, archivoNuevo);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error || "No fue posible agregar el documento.");
        return;
      }
      toast.success(
        reemplazaAhora
          ? "Documento reemplazado exitosamente"
          : "Documento agregado exitosamente",
      );
      setArchivoNuevo(null);
      cargar();
    });
  };

  const documentoDelTipo = documentos?.some((d) => d.tipoDocumento === tipoNuevo) ?? false;
  const nombreDocumento =
    tipoNuevo === "cedula" ? "una cédula" : "una partida de nacimiento";

  return (
    <section aria-label="Documentos del familiar" className="flex flex-col gap-3 rounded-sm border p-3">
      <h4 className="text-sm font-bold">Documentos Del Familiar</h4>

      {cargando ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : !documentos?.length ? (
        <p className="text-sm text-muted-foreground">No hay documentos registrados para este familiar.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documentos.map((documento) => (
            <div
              key={documento.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 p-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium">{etiquetaDocumento(documento.tipoDocumento)}</p>
                  <p className="truncate text-xs text-muted-foreground" title={documento.nombreArchivo}>
                    {documento.nombreArchivo || etiquetaDocumento(documento.tipoDocumento)} ·{" "}
                    {formatearFecha(documento.fechaSubida)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {documento.rutaArchivo && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={documento.rutaArchivo} target="_blank" rel="noopener noreferrer">
                      <FileDown className="mr-1 size-4" aria-hidden="true" /> Ver
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending && reemplazando === documento.id}
                  onClick={() => {
                    documentoAReemplazar.current = documento.id;
                    inputReemplazo.current?.click();
                  }}
                >
                  {isPending && reemplazando === documento.id ? (
                    <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="mr-1 size-4" aria-hidden="true" />
                  )}
                  Reemplazar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Un solo input oculto: el botón "Reemplazar" de cada fila lo dispara. */}
      <input
        ref={inputReemplazo}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        aria-label="Nueva versión del documento"
        onChange={(event) => {
          const archivo = event.target.files?.[0] ?? null;
          const id = documentoAReemplazar.current;
          event.target.value = "";
          if (id !== null) onReemplazar(id, archivo);
        }}
      />

      <div className="flex flex-col gap-3 border-t pt-4">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Agregar documento
        </h5>
        <div role="radiogroup" aria-label="Tipo de documento" className="grid grid-cols-2 gap-2">
          {TIPOS.map((tipo) => {
            const activo = tipoNuevo === tipo;
            return (
              <button
                key={tipo}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setTipoNuevo(tipo)}
                className={`flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                  activo
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background text-foreground hover:bg-accent"
                }`}
              >
                <FileText className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{etiquetaDocumento(tipo)}</span>
              </button>
            );
          })}
        </div>
        <FileUpload label="Archivo del documento" value={archivoNuevo} onChange={setArchivoNuevo} />
        {documentoDelTipo ? (
          <p
            role="note"
            className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          >
            Ya hay {nombreDocumento} cargada; se reemplazará.
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={!archivoNuevo || isPending}
            onClick={onAgregar}
          >
            {isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="mr-1 size-4" aria-hidden="true" />
            )}
            {documentoDelTipo ? "Reemplazar documento" : "Agregar documento"}
          </Button>
        </div>
      </div>
    </section>
  );
}
