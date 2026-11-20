"use client";

import { useEffect, useState } from "react";
import { ImageIcon, ImageOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ElementoBiblioteca } from "../../../domain/entities/carnet";
import {
  urlArchivoBiblioteca,
  type FondoCara,
} from "../../../domain/entities/disenador";
import { rasterizarFondoBibliotecaAction } from "../../../infrastructure/actions/carnetizacion-actions";
import { DisenadorBibliotecaDialog } from "./disenador-biblioteca-dialog";

const MIMES_FONDO = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

function fondoDesdeMedio(medio: ElementoBiblioteca): FondoCara {
  return {
    biblioteca_id: medio.id,
    nombre: medio.nombre,
    mime_type: medio.mime_type,
    ancho_px: medio.ancho_px,
    alto_px: medio.alto_px,
  };
}

interface DisenadorFondoPanelProps {
  cara: "anverso" | "reverso";
  fondo?: FondoCara;
  mediosBiblioteca: readonly ElementoBiblioteca[];
  cargandoMedios?: boolean;
  errorMedios?: string | null;
  onSeleccionarFondo: (cara: "anverso" | "reverso", fondo: FondoCara) => void;
  onQuitarFondo: (cara: "anverso" | "reverso") => void;
}

/**
 * Sección «Fondo» de la cara activa (B-2): elige una imagen de la Biblioteca de Medios
 * (o un PDF histórico, que el backend rasteriza a PNG al elegirlo), muestra la miniatura
 * y permite quitarlo. El fondo se guarda en la definición y el PDF lo dibuja antes de
 * los campos; no es una capa del lienzo.
 */
export function DisenadorFondoPanel({
  cara,
  fondo,
  mediosBiblioteca,
  cargandoMedios = false,
  errorMedios = null,
  onSeleccionarFondo,
  onQuitarFondo,
}: DisenadorFondoPanelProps) {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [convirtiendo, setConvirtiendo] = useState(false);
  // PDF elegido a la espera de indicar la página que se usará como fondo (H-13).
  const [pdfPendiente, setPdfPendiente] = useState<ElementoBiblioteca | null>(null);
  const [paginaPdf, setPaginaPdf] = useState("1");
  const [errorConversion, setErrorConversion] = useState<string | null>(null);
  const [estadoMiniatura, setEstadoMiniatura] = useState<"cargando" | "listo" | "error">(
    "cargando",
  );
  const urlMiniatura = fondo ? urlArchivoBiblioteca(fondo.biblioteca_id) : null;
  const esPdfGuardado = fondo?.mime_type === "application/pdf";

  useEffect(() => {
    setEstadoMiniatura("cargando");
  }, [fondo?.biblioteca_id]);

  const elegirMedio = async (medio: ElementoBiblioteca) => {
    if (!MIMES_FONDO.has(medio.mime_type)) {
      toast.error(
        "Para el fondo use PNG, JPEG, WebP o un PDF. Los SVG y GIF no se pueden incrustar en el PDF.",
      );
      return;
    }
    if (medio.mime_type !== "application/pdf") {
      onSeleccionarFondo(cara, fondoDesdeMedio(medio));
      toast.success(`Fondo del ${cara}: '${medio.nombre}'.`);
      return;
    }
    setPdfPendiente(medio);
    setPaginaPdf("1");
    setErrorConversion(null);
  };

  const convertirPdf = async () => {
    if (!pdfPendiente) return;
    const pagina = Number(paginaPdf);
    if (!Number.isInteger(pagina) || pagina < 1) {
      setErrorConversion("Indique un número de página entero mayor o igual a 1.");
      return;
    }
    setConvirtiendo(true);
    setErrorConversion(null);
    try {
      const res = await rasterizarFondoBibliotecaAction(pdfPendiente.id, pagina);
      if (!res.success || !res.data) {
        const mensaje = res.success ? "No se pudo convertir el PDF a PNG." : res.error;
        setErrorConversion(mensaje);
        toast.error(mensaje);
        return;
      }
      onSeleccionarFondo(cara, fondoDesdeMedio(res.data));
      toast.success(`Página ${pagina} de '${pdfPendiente.nombre}' convertida a PNG y usada como fondo.`);
      setPdfPendiente(null);
    } finally {
      setConvirtiendo(false);
    }
  };

  return (
    <Card className="shadow-xs border">
      <CardHeader className="p-3 pb-2 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <ImageIcon className="size-4" />
          Fondo · {cara}
        </CardTitle>
        <CardDescription className="text-[11px]">
          Imagen a sangre detrás de los campos de esta cara.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3 space-y-2 text-xs">
        {cargandoMedios && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Cargando biblioteca de medios…
          </p>
        )}
        {errorMedios && (
          <p role="alert" className="text-[11px] text-destructive">
            {errorMedios}
          </p>
        )}

        {fondo ? (
          <div className="space-y-2">
            <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-md border bg-muted/20">
              {esPdfGuardado || estadoMiniatura === "error" ? (
                <span className="flex flex-col items-center gap-1 px-2 text-center text-[10px] text-muted-foreground">
                  <ImageOff className="size-5" aria-hidden="true" />
                  {esPdfGuardado
                    ? "PDF guardado: vuelva a elegirlo para convertirlo a PNG."
                    : "No se pudo cargar la miniatura del fondo."}
                </span>
              ) : (
                <>
                  {estadoMiniatura === "cargando" && (
                    <Loader2 className="absolute size-5 animate-spin text-muted-foreground" />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlMiniatura ?? ""}
                    alt={`Fondo del ${cara}`}
                    className="max-h-full max-w-full object-contain"
                    onLoad={() => setEstadoMiniatura("listo")}
                    onError={() => setEstadoMiniatura("error")}
                  />
                </>
              )}
            </div>
            <p className="truncate text-[11px] font-medium" title={fondo.nombre}>
              {fondo.nombre || `Medio ${fondo.biblioteca_id}`}
            </p>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 flex-1 text-xs"
                onClick={() => setDialogoAbierto(true)}
                disabled={convirtiendo}
              >
                {convirtiendo ? <Loader2 className="size-3.5 animate-spin" /> : "Cambiar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => onQuitarFondo(cara)}
                aria-label={`Quitar fondo del ${cara}`}
              >
                <Trash2 className="size-3.5" />
                Quitar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed text-[11px] text-muted-foreground">
              Sin fondo: se usa el color de fondo de la plantilla.
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs"
              onClick={() => setDialogoAbierto(true)}
              disabled={convirtiendo || cargandoMedios}
            >
              {convirtiendo ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Convirtiendo PDF…
                </>
              ) : (
                "Elegir de la biblioteca"
              )}
            </Button>
          </div>
        )}

        {pdfPendiente && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-2">
            <p className="truncate text-[11px] font-medium" title={pdfPendiente.nombre}>
              PDF: {pdfPendiente.nombre}
            </p>
            <div className="space-y-1">
              <Label htmlFor="pagina-pdf-fondo" className="text-[11px]">
                Página del PDF
              </Label>
              <Input
                id="pagina-pdf-fondo"
                type="number"
                min={1}
                step={1}
                value={paginaPdf}
                onChange={(e) => setPaginaPdf(e.target.value)}
                disabled={convirtiendo}
                className="h-8 text-xs"
              />
            </div>
            {errorConversion && (
              <p role="alert" className="text-[11px] text-destructive">
                {errorConversion}
              </p>
            )}
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 text-xs"
                onClick={convertirPdf}
                disabled={convirtiendo}
              >
                {convirtiendo ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Convirtiendo PDF…
                  </>
                ) : (
                  "Usar esta página como fondo"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setPdfPendiente(null)}
                disabled={convirtiendo}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <DisenadorBibliotecaDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        mediosBiblioteca={[...mediosBiblioteca]}
        caraActual={cara}
        onSeleccionarMedio={elegirMedio}
        titulo={`Fondo del ${cara}`}
        descripcion="Elige una imagen de la Biblioteca de Medios. Si eliges un PDF, indicarás la página y el servidor la convierte a PNG."
      />
    </Card>
  );
}
