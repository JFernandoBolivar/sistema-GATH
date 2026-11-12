"use client";

import { useState } from "react";
import { Circle, Group, Line } from "react-konva";
import type Konva from "konva";

import type { ElementoKonva } from "../../../domain/entities/disenador";
import type { PuntoForma } from "../../../domain/entities/forma-puntos";

interface KonvaEdicionPuntosProps {
  elemento: ElementoKonva;
  escala: number;
  indiceSeleccionado: number | null;
  onSeleccionarPunto: (indice: number | null) => void;
  /** Se llama al soltar un tirador, con la posición nueva en la caja 0..100. */
  onMoverPunto: (indice: number, x: number, y: number) => void;
  /** Clic sobre una arista: posición del clic en la caja 0..100. */
  onAgregarPunto: (x: number, y: number) => void;
}

const COLOR = "#2563eb";

/** Tiradores arrastrables de los vértices de una forma, y aristas que agregan un punto al hacer clic. */
export function KonvaEdicionPuntos({
  elemento: el,
  escala,
  indiceSeleccionado,
  onSeleccionarPunto,
  onMoverPunto,
  onAgregarPunto,
}: KonvaEdicionPuntosProps) {
  const [vivos, setVivos] = useState<PuntoForma[] | null>(null);
  if (!el.puntos) return null;
  const w = el.w * escala;
  const h = el.h * escala;
  const lista = vivos ?? el.puntos;
  const aPx = (p: PuntoForma) => [(p.x * w) / 100, (p.y * h) / 100];
  const contorno = lista.flatMap(aPx);
  const cursor = (e: Konva.KonvaEventObject<MouseEvent>, valor: string) => {
    const contenedor = e.target.getStage()?.container();
    if (contenedor) contenedor.style.cursor = valor;
  };
  const agregarEnClic = (e: Konva.KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    const pos = e.target.getRelativePointerPosition();
    if (pos) onAgregarPunto((pos.x / w) * 100, (pos.y / h) * 100);
  };

  return (
    <Group x={el.x * escala} y={el.y * escala} rotation={el.r || 0}>
      <Line points={contorno} closed stroke={COLOR} strokeWidth={1} dash={[4, 3]} listening={false} />

      {lista.map((p, i) => {
        const [ax, ay] = aPx(p);
        const [bx, by] = aPx(lista[(i + 1) % lista.length]);
        return (
          <Line
            key={`arista-${i}`}
            points={[ax, ay, bx, by]}
            stroke="rgba(0,0,0,0.001)"
            strokeWidth={1}
            hitStrokeWidth={14}
            onMouseEnter={(e) => cursor(e, "copy")}
            onMouseLeave={(e) => cursor(e, "default")}
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onClick={agregarEnClic}
            onTap={agregarEnClic}
          />
        );
      })}

      {lista.map((p, i) => {
        const [x, y] = aPx(p);
        const activo = i === indiceSeleccionado;
        return (
          <Circle
            key={`punto-${i}`}
            x={x}
            y={y}
            radius={activo ? 7 : 5.5}
            fill={activo ? COLOR : "#ffffff"}
            stroke={COLOR}
            strokeWidth={2}
            draggable
            onMouseEnter={(e) => cursor(e, "move")}
            onMouseLeave={(e) => cursor(e, "default")}
            onMouseDown={(e) => {
              e.cancelBubble = true;
              onSeleccionarPunto(i);
            }}
            onClick={(e) => {
              e.cancelBubble = true;
              onSeleccionarPunto(i);
            }}
            onDragStart={() => onSeleccionarPunto(i)}
            onDragMove={(e) => {
              // Dentro de la caja del elemento (0..100)
              const nx = Math.min(w, Math.max(0, e.target.x()));
              const ny = Math.min(h, Math.max(0, e.target.y()));
              e.target.position({ x: nx, y: ny });
              setVivos(
                (el.puntos ?? []).map((q, k) =>
                  k === i ? { ...q, x: (nx / w) * 100, y: (ny / h) * 100 } : q,
                ),
              );
            }}
            onDragEnd={(e) => {
              setVivos(null);
              onMoverPunto(i, (e.target.x() / w) * 100, (e.target.y() / h) * 100);
            }}
          />
        );
      })}
    </Group>
  );
}
