"use client";

import { ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaginaFondo, PaginaOverlay } from "../../domain/entities/plantilla";
import { urlPaginaFondo } from "../lib/subir-archivo";

interface Props {
  plantillaId: string;
  version: string | number;
  fondoPaginas: PaginaFondo[];
  paginasDoc: PaginaOverlay[];
  paginaIdx: number;
  conErrorPaginas: Set<number>;
  soloLectura: boolean;
  onSeleccionar: (idx: number) => void;
  onAgregar: (origen: number) => void;
  onQuitar: (idx: number) => void;
  onMover: (idx: number, delta: -1 | 1) => void;
  onDuplicar: (idx: number) => void;
}

function Miniatura({ src, numero }: { src: string; numero: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- PNG autenticado servido por el proxy GET
    <img src={src} alt={`Página ${numero} del PDF`} loading="lazy" draggable={false} className="h-28 w-auto rounded border bg-white object-contain" />
  );
}

/** Páginas del documento (orden y selección) y páginas disponibles del PDF subido. */
export function MiniaturasPaginas(props: Props) {
  const { plantillaId, version, fondoPaginas, paginasDoc, paginaIdx } = props;
  return (
    <div className="grid gap-3">
      <section aria-labelledby="titulo-paginas-doc" className="grid gap-2">
        <h3 id="titulo-paginas-doc" className="text-sm font-semibold">Páginas del documento ({paginasDoc.length})</h3>
        {paginasDoc.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Aún no eligió páginas. Agregue una de las páginas del PDF para empezar a colocar campos.
          </p>
        )}
        <ol className="flex gap-3 overflow-x-auto pb-2" aria-label="Páginas del documento">
          {paginasDoc.map((p, i) => (
            <li key={i} className="shrink-0">
              <div className={cn("grid gap-1 rounded-lg border p-1.5", i === paginaIdx && "border-primary ring-1 ring-primary", props.conErrorPaginas.has(i) && "border-destructive")}>
                <button
                  type="button"
                  onClick={() => props.onSeleccionar(i)}
                  aria-pressed={i === paginaIdx}
                  aria-label={`Editar la página ${i + 1} del documento (página ${p.origen} del PDF)`}
                  className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Miniatura src={urlPaginaFondo(plantillaId, p.origen, version)} numero={p.origen} />
                </button>
                <p className="text-center text-xs">
                  {i + 1}. PDF p. {p.origen} · {p.campos.length} campos
                </p>
                {!props.soloLectura && (
                  <div className="flex justify-center">
                    <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => props.onMover(i, -1)} aria-label={`Mover la página ${i + 1} a la izquierda`}>
                      <ArrowLeft aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={i === paginasDoc.length - 1} onClick={() => props.onMover(i, 1)} aria-label={`Mover la página ${i + 1} a la derecha`}>
                      <ArrowRight aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => props.onDuplicar(i)} aria-label={`Duplicar la página ${i + 1}`}>
                      <Copy aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => props.onQuitar(i)} aria-label={`Quitar la página ${i + 1} del documento`}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {!props.soloLectura && (
        <section aria-labelledby="titulo-paginas-pdf" className="grid gap-2">
          <h3 id="titulo-paginas-pdf" className="text-sm font-semibold">Páginas del PDF ({fondoPaginas.length})</h3>
          <ul className="flex gap-3 overflow-x-auto pb-2" aria-label="Páginas disponibles del PDF">
            {fondoPaginas.map((f) => (
              <li key={f.numero} className="shrink-0">
                <div className="grid gap-1 rounded-lg border p-1.5">
                  <Miniatura src={urlPaginaFondo(plantillaId, f.numero, version)} numero={f.numero} />
                  <Button type="button" size="sm" variant="outline" onClick={() => props.onAgregar(f.numero)}>
                    <Plus aria-hidden /> Usar p. {f.numero}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
