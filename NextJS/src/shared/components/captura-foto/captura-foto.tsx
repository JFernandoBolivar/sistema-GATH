"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Camera, RefreshCw, RotateCcw, SwitchCamera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAX_BYTES_FOTO,
  detectarCamara,
  mensajeErrorCamara,
  validarFoto,
  type EstadoCamara,
  type OrigenFoto,
} from "./validar-foto";

export type { OrigenFoto } from "./validar-foto";

interface CapturaFotoProps {
  /** Se llama con la foto elegida (o `null` al repetir) y su origen. */
  onChange: (foto: File | null, origen: OrigenFoto | null) => void;
  /** Texto del control (por defecto «Foto»). */
  etiqueta?: string;
  maxBytes?: number;
  disabled?: boolean;
  /** Nombre del archivo generado al capturar con la cámara. */
  nombreArchivo?: string;
  /** Guía superpuesta sobre la vista en vivo (p. ej. encuadre de cédula en la fe de vida). */
  guia?: ReactNode;
  /** Foto ya elegida antes (p. ej. al volver a un paso de un asistente): se muestra como vista previa. */
  valorInicial?: File | null;
  className?: string;
}

type Modo = "subir" | "camara";

/**
 * Captura de foto reutilizable: cámara del dispositivo (si existe) o archivo JPG/PNG.
 * Nunca bloquea: si la cámara no está disponible, se niega o falla, queda siempre la vía de subida.
 */
export function CapturaFoto({
  onChange,
  etiqueta = "Foto",
  maxBytes = MAX_BYTES_FOTO,
  disabled = false,
  nombreArchivo = "foto.jpg",
  guia,
  valorInicial = null,
  className,
}: CapturaFotoProps) {
  const idBase = useId();
  const [camara, setCamara] = useState<EstadoCamara>({ estado: "detectando" });
  const [modo, setModo] = useState<Modo>("subir");
  const [enVivo, setEnVivo] = useState(false);
  const [frontal, setFrontal] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(() =>
    valorInicial ? URL.createObjectURL(valorInicial) : null,
  );
  const tieneVistaInicial = useRef(valorInicial !== null);
  const [tactil, setTactil] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const flujoRef = useRef<MediaStream | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const tactilRef = useRef<HTMLInputElement>(null);

  const detener = useCallback(() => {
    flujoRef.current?.getTracks().forEach((t) => t.stop());
    flujoRef.current = null;
    setEnVivo(false);
  }, []);

  useEffect(() => {
    return () => {
      if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    };
  }, [vistaPrevia]);

  const abrirCamara = useCallback(
    async (usarFrontal: boolean) => {
      setError(null);
      detener();
      try {
        const flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: usarFrontal ? "user" : "environment" },
          audio: false,
        });
        flujoRef.current = flujo;
        setEnVivo(true);
        setAviso(null);
      } catch (e) {
        setModo("subir");
        setAviso(mensajeErrorCamara(e));
      }
    },
    [detener],
  );

  useEffect(() => {
    let activo = true;
    void detectarCamara().then((estado) => {
      if (!activo) return;
      setCamara(estado);
      if (estado.estado === "disponible") {
        setModo("camara");
        if (!tieneVistaInicial.current) void abrirCamara(true);
      } else if (estado.estado === "no-disponible") setAviso(estado.motivo);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detección de dispositivo táctil, solo disponible en el cliente
    setTactil(
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
    );
    return () => {
      activo = false;
      detener();
    };
  }, [detener, abrirCamara]);

  // Conecta el flujo al <video> una vez que el elemento existe.
  useEffect(() => {
    if (enVivo && videoRef.current && flujoRef.current) {
      videoRef.current.srcObject = flujoRef.current;
      void videoRef.current.play?.().catch(() => undefined);
    }
  }, [enVivo]);

  function elegirModo(nuevo: Modo) {
    setModo(nuevo);
    setError(null);
    if (nuevo === "camara") {
      if (!vistaPrevia) void abrirCamara(frontal);
    } else {
      detener();
    }
  }

  function aceptar(archivo: File, origen: OrigenFoto) {
    const problema = validarFoto(archivo, maxBytes);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setVistaPrevia(URL.createObjectURL(archivo));
    detener();
    onChange(archivo, origen);
  }

  function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("La cámara aún no está lista. Espere un momento e intente de nuevo.");
      return;
    }
    const lienzo = document.createElement("canvas");
    lienzo.width = video.videoWidth;
    lienzo.height = video.videoHeight;
    lienzo.getContext("2d")?.drawImage(video, 0, 0);
    lienzo.toBlob(
      (blob) => {
        if (!blob) {
          setError("No se pudo capturar la foto. Intente de nuevo o suba una foto.");
          return;
        }
        aceptar(new File([blob], nombreArchivo, { type: "image/jpeg" }), "CAMARA");
      },
      "image/jpeg",
      0.9,
    );
  }

  function repetir() {
    setVistaPrevia(null);
    setError(null);
    onChange(null, null);
    if (archivoRef.current) archivoRef.current.value = "";
    if (modo === "camara") void abrirCamara(frontal);
  }

  function alElegirArchivo(origen: OrigenFoto, archivo?: File) {
    if (archivo) aceptar(archivo, origen);
  }

  const camaraOk = camara.estado === "disponible";

  return (
    <div className={cn("flex flex-col gap-3", className)} data-testid="captura-foto">
      <p id={`${idBase}-etiqueta`} className="text-base font-semibold">
        {etiqueta}
      </p>

      {vistaPrevia ? (
        <div className="flex flex-col items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no admite next/image */}
          <img
            src={vistaPrevia}
            alt="Vista previa de la foto seleccionada"
            className="max-h-72 w-auto max-w-full rounded-lg border object-contain"
          />
          <Button type="button" variant="outline" onClick={repetir} disabled={disabled}>
            <RotateCcw aria-hidden /> Repetir foto
          </Button>
        </div>
      ) : (
        <>
          <div role="group" aria-labelledby={`${idBase}-etiqueta`} className="flex flex-wrap gap-2">
            {camaraOk ? (
              <Button
                type="button"
                variant={modo === "camara" ? "default" : "outline"}
                aria-pressed={modo === "camara"}
                disabled={disabled}
                onClick={() => elegirModo("camara")}
              >
                <Camera aria-hidden /> Tomar foto
              </Button>
            ) : null}
            <Button
              type="button"
              variant={modo === "subir" ? "default" : "outline"}
              aria-pressed={modo === "subir"}
              disabled={disabled}
              onClick={() => elegirModo("subir")}
            >
              <Upload aria-hidden /> Subir foto
            </Button>
          </div>

          {modo === "camara" && camaraOk ? (
            <div className="flex flex-col gap-3">
              {enVivo ? (
                <div className="relative w-full max-w-md overflow-hidden rounded-lg border bg-black">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    aria-label="Vista en vivo de la cámara"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  {guia ? <div className="pointer-events-none absolute inset-0">{guia}</div> : null}
                </div>
              ) : (
                <p role="status" className="text-sm text-muted-foreground">
                  Abriendo la cámara…
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="lg" disabled={disabled || !enVivo} onClick={capturar}>
                  <Camera aria-hidden /> Capturar foto
                </Button>
                {camara.estado === "disponible" && camara.varias ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => {
                      const siguiente = !frontal;
                      setFrontal(siguiente);
                      void abrirCamara(siguiente);
                    }}
                  >
                    <SwitchCamera aria-hidden /> Cambiar cámara
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor={`${idBase}-archivo`} className="text-sm text-muted-foreground">
                Archivo JPG o PNG, hasta {Math.round(maxBytes / (1024 * 1024))} MB
              </label>
              <input
                ref={archivoRef}
                id={`${idBase}-archivo`}
                type="file"
                accept="image/jpeg,image/png"
                disabled={disabled}
                onChange={(e) => alElegirArchivo("ARCHIVO", e.target.files?.[0])}
                className="block min-h-11 w-full max-w-md rounded-md border border-input bg-card p-2 text-base file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-primary file:px-3 file:font-semibold file:text-primary-foreground"
              />
              {tactil ? (
                <>
                  <input
                    ref={tactilRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => alElegirArchivo("CAMARA", e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    disabled={disabled}
                    onClick={() => tactilRef.current?.click()}
                  >
                    <Camera aria-hidden /> Usar la cámara del teléfono
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </>
      )}

      {aviso ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning"
        >
          <RefreshCw className="mt-0.5 size-4 shrink-0" aria-hidden />
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
