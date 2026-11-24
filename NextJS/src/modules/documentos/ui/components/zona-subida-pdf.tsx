"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { validarPdfFondo } from "../lib/subir-archivo";

interface Props {
  nombreActual: string | null;
  numPaginas: number;
  subiendo: boolean;
  progreso: number | null;
  maxBytes?: number;
  soloLectura: boolean;
  onSubir: (archivo: File) => Promise<boolean>;
}

/** Subida del PDF de fondo: arrastrar y soltar o botón; valida .pdf y tamaño antes de enviar. */
export function ZonaSubidaPdf({ nombreActual, numPaginas, subiendo, progreso, maxBytes, soloLectura, onSubir }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);

  const recibir = async (archivo: File | undefined) => {
    if (!archivo) return;
    const problema = validarPdfFondo(archivo, maxBytes);
    if (problema) return toast.error(problema);
    await onSubir(archivo);
  };

  return (
    <div
      data-testid="zona-subida-pdf"
      onDragOver={(e) => {
        if (soloLectura) return;
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        if (!soloLectura && !subiendo) void recibir(e.dataTransfer.files?.[0]);
      }}
      className={cn("grid gap-3 rounded-xl border-2 border-dashed p-5 text-center transition-colors", encima ? "border-primary bg-primary/5" : "bg-background")}
    >
      <FileUp className="mx-auto size-8 text-muted-foreground" aria-hidden />
      {nombreActual ? (
        <p className="text-sm">
          <span className="font-medium">{nombreActual}</span> · {numPaginas} página{numPaginas === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="text-sm font-medium">Suba el PDF del formato oficial</p>
      )}
      <p className="text-xs text-muted-foreground">Arrastre el archivo aquí o elíjalo. Solo PDF, hasta 15 MB.</p>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Elegir el PDF de fondo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void recibir(f);
        }}
      />
      <div className="flex justify-center">
        <Button type="button" variant={nombreActual ? "outline" : "default"} disabled={soloLectura || subiendo} onClick={() => input.current?.click()}>
          {subiendo ? <Loader2 className="animate-spin" aria-hidden /> : <FileUp aria-hidden />}
          {subiendo ? "Subiendo…" : nombreActual ? "Reemplazar PDF" : "Elegir PDF"}
        </Button>
      </div>
      {subiendo && progreso !== null && (
        <div className="grid gap-1" role="status">
          <Progress value={progreso} aria-label="Progreso de la subida" />
          <p className="text-xs text-muted-foreground">{progreso < 100 ? `Subiendo… ${progreso} %` : "Procesando el PDF…"}</p>
        </div>
      )}
    </div>
  );
}
