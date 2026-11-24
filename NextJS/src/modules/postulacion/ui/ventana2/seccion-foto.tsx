"use client";

import { useEffect, useRef, useState } from "react";
/* eslint-disable @next/next/no-img-element */
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Ventana2DTO } from "../../application/dtos/postulacion-dto";
import { formatearTamanoFoto, FOTO, validarDimensionesFoto, validarTipoYTamanoFoto } from "../../domain/ventana2";
import { medirImagen, subirFoto } from "./subir-foto";

interface Props {
  foto: Ventana2DTO["foto"];
  onSubida: (v: Ventana2DTO) => void;
  onContinuar: () => void;
  onAnterior?: () => void;
  onSesionCaida: () => void;
}

const RECOMENDACIONES = [
  "Fondo claro y liso, sin objetos detrás.",
  "De frente, con el rostro completo y la mirada a la cámara.",
  "Sin lentes oscuros, gorra ni filtros.",
  "Buena luz, sin sombras fuertes en la cara.",
  `JPEG o PNG, de al menos ${FOTO.minLado}x${FOTO.minLado} píxeles y hasta 5 MB.`,
];

export function SeccionFoto({ foto, onSubida, onContinuar, onAnterior, onSesionCaida }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [version, setVersion] = useState(() => foto.subidaEl ?? "0");
  const entrada = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const subiendo = progreso !== null;

  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);

  async function elegir(f: File | null | undefined) {
    if (!f) return;
    setError(null);
    const problema = validarTipoYTamanoFoto(f);
    if (problema) return setError(problema);
    const url = URL.createObjectURL(f);
    const medida = await medirImagen(url);
    if (!medida) {
      URL.revokeObjectURL(url);
      return setError("No pudimos leer esa imagen. Elige otra foto.");
    }
    const pequena = validarDimensionesFoto(medida.ancho, medida.alto);
    if (pequena) {
      URL.revokeObjectURL(url);
      return setError(pequena);
    }
    setArchivo(f);
    setVista(url);
  }

  async function subir() {
    if (!archivo) return;
    setError(null);
    setProgreso(0);
    const r = await subirFoto(archivo, setProgreso);
    setProgreso(null);
    if (!r.ok) {
      if (r.sesionCaida) return onSesionCaida();
      return setError(r.mensaje);
    }
    setArchivo(null);
    setVista(null);
    setVersion(r.ventana2.foto.subidaEl ?? String(Date.now()));
    onSubida(r.ventana2);
  }

  const mostrada = vista ?? (foto.tiene ? `/postulacion/foto?v=${encodeURIComponent(version)}` : null);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Tu foto de carnet</h2>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">Es la foto que irá en tu carnet de CONATEL. Elige una buena: la vas a usar mucho.</p>
        <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,16rem)_1fr]">
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); void elegir(e.dataTransfer.files?.[0]); }}
            className={cn("relative flex aspect-square w-full max-w-64 items-center justify-center overflow-hidden self-start rounded-xl border-2 border-dashed bg-muted/40", arrastrando && "border-primary bg-primary/5", mostrada && "border-solid")}
          >
            {mostrada ? (
              <img src={mostrada} alt="Vista previa de tu foto de carnet" className="size-full object-cover" data-testid="foto-vista" />
            ) : (
              <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-muted-foreground">
                <UploadCloud className="size-10" aria-hidden />
                <p>Arrastra tu foto aquí o usa los botones.</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1.5 text-sm">
              {RECOMENDACIONES.map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-pretty">{r}</span>
                </li>
              ))}
            </ul>
            <input ref={entrada} type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} data-testid="foto-archivo" aria-label="Elegir foto desde el equipo" onChange={(e) => { void elegir(e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={camara} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} data-testid="foto-camara" aria-hidden="true" onChange={(e) => { void elegir(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <Button type="button" variant="outline" size="lg" onClick={() => entrada.current?.click()} disabled={subiendo}>
                <ImagePlus aria-hidden /> {foto.tiene || archivo ? "Elegir otra" : "Elegir foto"}
              </Button>
              <Button type="button" variant="outline" size="lg" className="md:hidden" onClick={() => camara.current?.click()} disabled={subiendo}>
                <Camera aria-hidden /> Tomar foto
              </Button>
            </div>
            {archivo && (
              <p className="text-sm text-muted-foreground">
                {archivo.name} · {formatearTamanoFoto(archivo.size)}
              </p>
            )}
            {!archivo && foto.tiene && (
              <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" aria-hidden /> Foto guardada {foto.tamano ? `(${formatearTamanoFoto(foto.tamano)})` : ""}
              </p>
            )}
            {subiendo && (
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso ?? 0} aria-label="Progreso de la subida" className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-[width]" style={{ width: `${progreso}%` }} />
              </div>
            )}
            {archivo && (
              <Button type="button" size="lg" onClick={() => void subir()} disabled={subiendo} className="sm:self-start">
                {subiendo ? <Loader2 className="animate-spin" aria-hidden /> : <UploadCloud aria-hidden />}
                {subiendo ? `Subiendo… ${progreso}%` : "Guardar esta foto"}
              </Button>
            )}
          </div>
        </div>
      </section>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:shadow-sm">
        {onAnterior ? (
          <Button type="button" variant="ghost" size="sm" onClick={onAnterior} disabled={subiendo}>
            <ArrowLeft aria-hidden /> Anterior
          </Button>
        ) : <span />}
        <Button type="button" size="lg" onClick={onContinuar} disabled={subiendo || !foto.tiene || !!archivo}>
          Continuar
        </Button>
      </div>
      {archivo && <p className="text-center text-xs text-muted-foreground">Guarda la foto elegida para poder continuar.</p>}
    </div>
  );
}
