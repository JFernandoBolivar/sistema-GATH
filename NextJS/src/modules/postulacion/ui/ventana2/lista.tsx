"use client";

import { Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** Tarjeta de un elemento de una lista (estudio, curso, experiencia, idioma), con su botón «Quitar». */
export function TarjetaItem({
  titulo,
  subtitulo,
  etiquetaQuitar,
  onQuitar,
  children,
  testId,
}: {
  titulo: string;
  subtitulo?: string;
  etiquetaQuitar: string;
  onQuitar: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm sm:p-5" data-testid={testId}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-base font-semibold">
          {titulo}
          {subtitulo && <span className="font-normal text-muted-foreground"> · {subtitulo}</span>}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onQuitar} aria-label={etiquetaQuitar} className="text-destructive">
          <Trash2 aria-hidden /> Quitar
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </li>
  );
}

/** Casilla «No tengo…»: declara expresamente que no hay nada que registrar; se bloquea mientras la lista tenga elementos. */
export function CasillaNoTengo({
  id,
  etiqueta,
  marcada,
  bloqueada,
  mensajeBloqueada,
  onCambio,
  error,
}: {
  id: string;
  etiqueta: string;
  marcada: boolean;
  bloqueada: boolean;
  mensajeBloqueada: string;
  onCambio: (marcada: boolean) => void;
  error?: string;
}) {
  return (
    <>
      <div className="mt-4 flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
        <Checkbox id={id} checked={marcada} disabled={bloqueada} onCheckedChange={(v) => onCambio(v === true)} className="mt-0.5 size-5" />
        <div className="min-w-0">
          <Label htmlFor={id} className="cursor-pointer text-base font-medium">
            {etiqueta}
          </Label>
          {bloqueada && <p className="text-sm text-muted-foreground">{mensajeBloqueada}</p>}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </>
  );
}

export function ListaVacia({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="text-pretty">{children}</p>
    </div>
  );
}

export function EncabezadoSeccion({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {icono} {titulo}
      </h2>
      <p className="mt-1 text-sm text-pretty text-muted-foreground">{children}</p>
    </section>
  );
}
