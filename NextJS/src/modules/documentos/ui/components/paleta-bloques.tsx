"use client";

import {
  Columns3,
  Image as ImageIcon,
  ListChecks,
  Minus,
  PenLine,
  Pilcrow,
  SeparatorHorizontal,
  Table2,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TipoBloque } from "../../domain/entities/plantilla";
import { ETIQUETAS_BLOQUE } from "../../domain/lib/factorias";

const ICONOS: Record<TipoBloque, LucideIcon> = {
  seccion: Minus,
  fila_campos: Columns3,
  casillas: ListChecks,
  tabla: Table2,
  parrafo: Pilcrow,
  foto: ImageIcon,
  firmas: PenLine,
  salto_pagina: SeparatorHorizontal,
};

const DESCRIPCIONES: Record<TipoBloque, string> = {
  seccion: "Título de un apartado",
  fila_campos: "Datos en una fila, con etiqueta",
  casillas: "Opciones que se marcan según un dato",
  tabla: "Lista de familiares, estudios, cursos…",
  parrafo: "Texto con datos insertados",
  foto: "Foto del trabajador",
  firmas: "Líneas de firma",
  salto_pagina: "Empieza una página nueva",
};

const ORDEN: TipoBloque[] = ["seccion", "fila_campos", "casillas", "tabla", "parrafo", "foto", "firmas", "salto_pagina"];

interface Props {
  onAgregar: (tipo: TipoBloque) => void;
  deshabilitado?: boolean;
  /** Dónde se insertará (para el texto de ayuda). */
  haySeleccion: boolean;
}

/** Paleta de bloques: un clic agrega al final, o tras el bloque seleccionado. */
export function PaletaBloques({ onAgregar, deshabilitado, haySeleccion }: Props) {
  return (
    <section aria-labelledby="titulo-paleta" className="grid min-w-0 gap-2">
      <div>
        <h3 id="titulo-paleta" className="font-semibold">Agregar bloque</h3>
        <p className="text-xs text-muted-foreground">
          {haySeleccion ? "Se agrega justo después del bloque seleccionado." : "Se agrega al final del documento."}
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
        {ORDEN.map((tipo) => {
          const Icono = ICONOS[tipo];
          return (
            <Button
              key={tipo}
              type="button"
              variant="outline"
              disabled={deshabilitado}
              title={DESCRIPCIONES[tipo]}
              className="h-auto min-w-0 justify-start gap-2 overflow-hidden whitespace-normal px-3 py-2 text-left"
              onClick={() => onAgregar(tipo)}
            >
              <Icono className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium leading-tight">{ETIQUETAS_BLOQUE[tipo]}</span>
                <span className="line-clamp-2 break-words text-xs font-normal text-muted-foreground">{DESCRIPCIONES[tipo]}</span>
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
