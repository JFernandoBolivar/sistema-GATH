"use client";

import { ArrowLeft, ArrowRight, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CapturaFoto, type OrigenFoto } from "@/shared/components/captura-foto/captura-foto";

interface Props {
  /** Ya hay una foto guardada en el servidor y no se exige otra. */
  fotoVigente: boolean;
  /** Bienestar pidió una foto nueva. */
  exigeNueva: boolean;
  fotoElegida: File | null;
  subiendo: boolean;
  onFoto: (foto: File | null, origen: OrigenFoto | null) => void;
  onAtras: () => void;
  onContinuar: () => void;
}

/** Paso: foto del pasivo sosteniendo su cédula, con la cámara o subiendo un archivo. */
export function PasoFoto({
  fotoVigente,
  exigeNueva,
  fotoElegida,
  subiendo,
  onFoto,
  onAtras,
  onContinuar,
}: Props) {
  const puedeContinuar = !!fotoElegida || (fotoVigente && !exigeNueva);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Foto con su cédula</h2>
      <p className="text-base">
        Tómese una foto en la que se vea su rostro y su cédula de identidad, bien iluminada y sin
        reflejos. Si la cámara no funciona, puede subir una foto desde su equipo.
      </p>
      {exigeNueva ? (
        <p role="status" className="rounded-md border border-warning/40 bg-warning-soft p-3 text-base">
          Bienestar Social pidió una foto nueva. Debe tomarla de nuevo antes de reenviar.
        </p>
      ) : fotoVigente ? (
        <p role="status" className="rounded-md bg-muted p-3 text-base">
          Ya tiene una foto cargada. Puede conservarla o tomar otra.
        </p>
      ) : null}
      <CapturaFoto
        etiqueta="Foto con su cédula"
        nombreArchivo="fe-de-vida-cedula.jpg"
        disabled={subiendo}
        onChange={onFoto}
        guia={
          <div className="pointer-events-none flex size-full items-end justify-center p-3">
            <span className="inline-flex items-center gap-2 rounded-md bg-black/60 px-3 py-1 text-sm text-white">
              <IdCard className="size-4" aria-hidden /> Muestre su cédula junto a su rostro
            </span>
          </div>
        }
      />
      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="outline" className="min-h-11" onClick={onAtras} disabled={subiendo}>
          <ArrowLeft aria-hidden /> Atrás
        </Button>
        <Button type="button" className="min-h-11" onClick={onContinuar} disabled={!puedeContinuar || subiendo}>
          {subiendo ? "Cargando foto…" : "Continuar"} <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
