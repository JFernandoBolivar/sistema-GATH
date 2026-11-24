"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Bloque } from "../../domain/entities/plantilla";
import { ETIQUETAS_BLOQUE } from "../../domain/lib/factorias";
import { resumenBloque } from "../../domain/lib/resumen";

interface Props {
  bloques: Bloque[];
  seleccionadoId: string | null;
  /** Ids de bloque con errores (se marcan en rojo). */
  conErrorIds: Set<string>;
  soloLectura: boolean;
  onSeleccionar: (id: string) => void;
  onReordenar: (desdeId: string, haciaIndice: number) => void;
  onMover: (id: string, delta: -1 | 1) => void;
  onDuplicar: (id: string) => void;
  onEliminar: (id: string) => void;
}

function ItemBloque({
  bloque,
  indice,
  total,
  seleccionado,
  conError,
  soloLectura,
  onSeleccionar,
  onMover,
  onDuplicar,
  onEliminar,
}: {
  bloque: Bloque;
  indice: number;
  total: number;
  seleccionado: boolean;
  conError: boolean;
  soloLectura: boolean;
  onSeleccionar: () => void;
  onMover: (delta: -1 | 1) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: bloque.id,
    disabled: soloLectura,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-bloque-id={bloque.id}
      className={cn(
        "flex min-w-0 items-stretch gap-1 rounded-lg border bg-background",
        seleccionado && "border-primary ring-1 ring-primary",
        conError && "border-destructive",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={soloLectura}
        aria-label={`Arrastrar el bloque ${indice + 1}: ${ETIQUETAS_BLOQUE[bloque.tipo]}. Con teclado: espacio y flechas.`}
        className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onSeleccionar}
        aria-pressed={seleccionado}
        className="min-w-0 flex-1 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block text-xs font-medium uppercase tracking-wide text-primary">
          {indice + 1}. {ETIQUETAS_BLOQUE[bloque.tipo]}
        </span>
        <span className="block truncate text-sm">{resumenBloque(bloque)}</span>
        {conError && <span className="block text-xs text-destructive">Tiene datos por corregir</span>}
      </button>
      {!soloLectura && (
        <div className="flex shrink-0 items-center pr-1">
          <Button type="button" variant="ghost" size="icon-sm" disabled={indice === 0} onClick={() => onMover(-1)} aria-label="Subir bloque">
            <ArrowUp aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" disabled={indice === total - 1} onClick={() => onMover(1)} aria-label="Bajar bloque">
            <ArrowDown aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onDuplicar} aria-label="Duplicar bloque">
            <Copy aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onEliminar} aria-label="Eliminar bloque" className="text-destructive">
            <Trash2 aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

/** Lista ordenable de bloques: arrastre (ratón, táctil y teclado) y botones subir/bajar como alternativa. */
export function ListaBloques(props: Props) {
  const { bloques, onReordenar } = props;
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const alSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const haciaIndice = bloques.findIndex((b) => b.id === e.over!.id);
    if (haciaIndice >= 0) onReordenar(String(e.active.id), haciaIndice);
  };

  if (bloques.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        El documento está vacío. Agregue su primer bloque desde la paleta.
      </p>
    );
  }

  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
      <SortableContext items={bloques.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ol className="grid min-w-0 gap-2" aria-label="Bloques del documento">
          {bloques.map((b, i) => (
            <ItemBloque
              key={b.id}
              bloque={b}
              indice={i}
              total={bloques.length}
              seleccionado={props.seleccionadoId === b.id}
              conError={props.conErrorIds.has(b.id)}
              soloLectura={props.soloLectura}
              onSeleccionar={() => props.onSeleccionar(b.id)}
              onMover={(d) => props.onMover(b.id, d)}
              onDuplicar={() => props.onDuplicar(b.id)}
              onEliminar={() => props.onEliminar(b.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
