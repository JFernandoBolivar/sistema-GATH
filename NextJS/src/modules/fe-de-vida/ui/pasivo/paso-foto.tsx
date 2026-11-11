"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, IdCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CapturaFoto, type OrigenFoto } from "@/shared/components/captura-foto/captura-foto";
import { AyudaPermisoCamara } from "./ayuda-permiso-camara";

/** F2-11: se admite un original grande porque la validación final es tras reducir. */
const MAX_BYTES_ORIGINAL = 25 * 1024 * 1024;

interface Props {
  /** Ya hay una foto guardada en el servidor y no se exige otra. */
  fotoVigente: boolean;
  /** Bienestar pidió una foto nueva. */
  exigeNueva: boolean;
  fotoElegida: File | null;
  subiendo: boolean;
  mensajeSubida?: string;
  fotoRecuperadaLocal?: boolean;
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
  mensajeSubida,
  fotoRecuperadaLocal = false,
  onFoto,
  onAtras,
  onContinuar,
}: Props) {
  const puedeContinuar = !!fotoElegida || (fotoVigente && !exigeNueva);
  // Con una foto ya guardada (y sin pedido de foto nueva) la captura queda plegada: mostrar
  // «Tomar foto» y el aviso de la cámara hacía creer que la foto no se había cargado.
  const [cambiando, setCambiando] = useState(false);
  const mostrarCaptura = exigeNueva || !fotoVigente || cambiando || !!fotoElegida;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Foto con su cédula</h2>
      {/* Instrucciones en pasos cortos y letra grande: la usan personas jubiladas y pensionadas. */}
      <ul className="flex list-disc flex-col gap-1.5 pl-6 text-lg leading-relaxed font-medium">
        <li>
          Que se vean su <strong>rostro</strong> y su <strong>cédula de identidad</strong>.
        </li>
        <li>Con buena luz y sin reflejos.</li>
        <li>Si la cámara no funciona, use «Subir foto» para cargar una foto desde su equipo.</li>
      </ul>

      {/* Aviso de foto recuperada localmente (IndexedDB) tras recarga o intermitencia */}
      {fotoRecuperadaLocal && fotoElegida ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-base text-primary font-medium"
        >
          <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
          Foto recuperada de este dispositivo lista para enviar.
        </p>
      ) : null}

      {/* Con una foto ya elegida el aviso sobra: desaparece al tomarla o cargarla. */}
      {exigeNueva && !fotoElegida ? (
        <p
          role="status"
          className="rounded-md border border-warning/40 bg-warning-soft p-3 text-base"
        >
          Se requiere una foto nueva para reenviar su fe de vida.
        </p>
      ) : !exigeNueva && fotoVigente && !fotoElegida ? (
        <p role="status" className="rounded-md bg-muted p-3 text-base">
          Ya tiene una foto cargada. Puede conservarla o tomar otra.
        </p>
      ) : null}

      {mostrarCaptura ? (
        <CapturaFoto
          etiqueta="Foto con su cédula"
          maxBytes={MAX_BYTES_ORIGINAL}
          valorInicial={fotoElegida}
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
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start"
          onClick={() => setCambiando(true)}
          disabled={subiendo}
        >
          <Camera aria-hidden /> Cambiar foto
        </Button>
      )}

      {/* Ayuda visual para permisos de cámara en Android e iOS */}
      <AyudaPermisoCamara className="mt-1" />

      <div className="flex flex-wrap justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onAtras}
          disabled={subiendo}
        >
          <ArrowLeft aria-hidden /> Atrás
        </Button>
        <Button
          type="button"
          className="min-h-11"
          onClick={onContinuar}
          disabled={!puedeContinuar || subiendo}
        >
          {subiendo ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {subiendo ? (mensajeSubida ?? "Cargando foto…") : "Continuar"}{" "}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
