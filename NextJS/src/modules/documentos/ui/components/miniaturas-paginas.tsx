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
  /** `vertical`: riel a la izquierda del lienzo (escritorio). `horizontal`: tira desplazable (teléfono). */
  orientacion: "vertical" | "horizontal";
  onSeleccionar: (idx: number) => void;
  onAgregar: (origen: number) => void;
  onQuitar: (idx: number) => void;
  onMover: (idx: number, delta: -1 | 1) => void;
  onDuplicar: (idx: number) => void;
}

function Miniatura({ src, numero }: { src: string; numero: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- PNG autenticado servido por el proxy GET
    <img src={src} alt={`Página ${numero} del PDF`} loading="lazy" draggable={false} className="h-20 w-auto max-w-full rounded border bg-white object-contain" />
  );
}

/** Páginas del documento (orden y selección) y páginas disponibles del PDF subido, en formato compacto. */
export function MiniaturasPaginas(props: Props) {
  const { plantillaId, version, fondoPaginas, paginasDoc, paginaIdx, orientacion } = props;
  const vertical = orientacion === "vertical";
  const lista = vertical ? "flex flex-col items-center gap-2" : "flex gap-2 overflow-x-auto pb-1";
  const sel = paginasDoc[paginaIdx];
  return (
    <div className={cn("grid min-w-0 gap-2", vertical && "content-start")}>
      <section aria-labelledby="titulo-paginas-doc" className="grid min-w-0 gap-1">
        <h3 id="titulo-paginas-doc" className="text-xs font-semibold">Documento ({paginasDoc.length})</h3>
        {paginasDoc.length === 0 && (
          <p className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">Agregue una página del PDF para empezar.</p>
        )}
        <ol className={lista} aria-label="Páginas del documento">
          {paginasDoc.map((p, i) => (
            <li key={i} className="shrink-0">
              <button
                type="button"
                onClick={() => props.onSeleccionar(i)}
                aria-pressed={i === paginaIdx}
                aria-label={`Editar la página ${i + 1} del documento (página ${p.origen} del PDF)`}
                className={cn(
                  "grid gap-0.5 rounded-lg border p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === paginaIdx && "border-primary ring-1 ring-primary",
                  props.conErrorPaginas.has(i) && "border-destructive",
                )}
              >
                <Miniatura src={urlPaginaFondo(plantillaId, p.origen, version)} numero={p.origen} />
                <span className="text-center text-[11px] leading-tight">
                  {i + 1}. p. {p.origen} · {p.campos.length} c.
                </span>
              </button>
            </li>
          ))}
        </ol>
        {!props.soloLectura && sel && (
          <div className="flex flex-wrap justify-center" role="group" aria-label={`Acciones de la página ${paginaIdx + 1}`}>
            <Button type="button" variant="ghost" size="icon-sm" disabled={paginaIdx === 0} onClick={() => props.onMover(paginaIdx, -1)} aria-label={`Mover la página ${paginaIdx + 1} hacia atrás`}>
              <ArrowLeft aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" disabled={paginaIdx === paginasDoc.length - 1} onClick={() => props.onMover(paginaIdx, 1)} aria-label={`Mover la página ${paginaIdx + 1} hacia adelante`}>
              <ArrowRight aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => props.onDuplicar(paginaIdx)} aria-label={`Duplicar la página ${paginaIdx + 1}`}>
              <Copy aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => props.onQuitar(paginaIdx)} aria-label={`Quitar la página ${paginaIdx + 1} del documento`}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        )}
      </section>

      {!props.soloLectura && (
        <section aria-labelledby="titulo-paginas-pdf" className="grid min-w-0 gap-1 border-t pt-2">
          <h3 id="titulo-paginas-pdf" className="text-xs font-semibold">PDF ({fondoPaginas.length})</h3>
          <ul className={lista} aria-label="Páginas disponibles del PDF">
            {fondoPaginas.map((f) => (
              <li key={f.numero} className="shrink-0">
                <div className="grid gap-0.5 rounded-lg border p-1">
                  <Miniatura src={urlPaginaFondo(plantillaId, f.numero, version)} numero={f.numero} />
                  <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => props.onAgregar(f.numero)} aria-label={`Usar la página ${f.numero} del PDF`}>
                    <Plus aria-hidden /> p. {f.numero}
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
