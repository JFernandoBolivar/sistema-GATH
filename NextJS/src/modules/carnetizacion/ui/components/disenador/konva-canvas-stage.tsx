"use client";

import { useEffect, useRef, useState } from "react";
import { Layer, Line, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";

import type { ElementoKonva, PersonaMuestra } from "../../../domain/entities/disenador";
import { KonvaElementoItem } from "./konva-elemento-item";

interface Props {
  anchoMm: number;
  altoMm: number;
  escala: number;
  elementos: ElementoKonva[];
  caraActual: "anverso" | "reverso";
  elementoSeleccionadoId: string | null;
  onSeleccionarElemento: (id: string | null) => void;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
  datosPersona: PersonaMuestra;
  coloresRegla?: { primario: string; acento: string; texto: string };
  mostrarGuias?: boolean;
}

export function KonvaCanvasStage({
  anchoMm,
  altoMm,
  escala,
  elementos,
  caraActual,
  elementoSeleccionadoId,
  onSeleccionarElemento,
  onActualizarElemento,
  datosPersona,
  coloresRegla = { primario: "#16264a", acento: "#d9121f", texto: "#ffffff" },
  mostrarGuias = true,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [imagenesCargadas, setImagenesCargadas] = useState<Record<string, HTMLImageElement>>({});
  const [guiasActivas, setGuiasActivas] = useState<{ x?: number; y?: number }>({});

  const anchoPx = anchoMm * escala;
  const altoPx = altoMm * escala;

  // Filtrar elementos de la cara visible
  const elementosCara = elementos.filter((e) => e.cara === caraActual && !e.oculto);

  // Cargar imágenes en memoria para Konva
  useEffect(() => {
    elementosCara.forEach((el) => {
      if ((el.t === "image" || el.t === "photo") && el.src && !imagenesCargadas[el.src]) {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = el.src;
        img.onload = () => {
          setImagenesCargadas((prev) => ({ ...prev, [el.src as string]: img }));
        };
      }
    });
  }, [elementosCara, imagenesCargadas]);

  // Actualizar el Transformer de Konva cuando cambia la selección
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    if (!elementoSeleccionadoId) {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
      return;
    }
    const node = stageRef.current.findOne(`#node-${elementoSeleccionadoId}`);
    if (node) {
      trRef.current.nodes([node]);
      trRef.current.getLayer()?.batchDraw();
    } else {
      trRef.current.nodes([]);
    }
  }, [elementoSeleccionadoId, elementosCara]);

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === stageRef.current || e.target.name() === "canvas-background") {
      onSeleccionarElemento(null);
    }
  };

  return (
    <Stage
      ref={stageRef}
      width={anchoPx}
      height={altoPx}
      onClick={handleStageClick}
      onTap={handleStageClick}
      className="shadow-2xl rounded-sm overflow-hidden border border-border/80"
    >
      <Layer>
        {/* Fondo físico del carnet */}
        <Rect
          name="canvas-background"
          x={0}
          y={0}
          width={anchoPx}
          height={altoPx}
          fill="#ffffff"
          cornerRadius={4 * escala}
        />

        {/* Guías de Imán en el Centro (Snap Guides) */}
        {mostrarGuias && guiasActivas.x !== undefined && (
          <Line
            points={[guiasActivas.x, 0, guiasActivas.x, altoPx]}
            stroke="#3b82f6"
            strokeWidth={1}
            dash={[4, 4]}
          />
        )}
        {mostrarGuias && guiasActivas.y !== undefined && (
          <Line
            points={[0, guiasActivas.y, anchoPx, guiasActivas.y]}
            stroke="#3b82f6"
            strokeWidth={1}
            dash={[4, 4]}
          />
        )}

        {/* Capas y Elementos */}
        {elementosCara.map((el) => (
          <KonvaElementoItem
            key={el.id}
            elemento={el}
            escala={escala}
            anchoPx={anchoPx}
            altoPx={altoPx}
            datosPersona={datosPersona}
            coloresRegla={coloresRegla}
            imagenesCargadas={imagenesCargadas}
            onSeleccionarElemento={onSeleccionarElemento}
            onActualizarElemento={onActualizarElemento}
            onActualizarGuias={setGuiasActivas}
          />
        ))}

        {/* Transformer interactivo para mover, rotar y escalar */}
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
          anchorSize={8}
          anchorStroke="#2563eb"
          anchorFill="#ffffff"
          borderStroke="#2563eb"
          borderStrokeWidth={1.5}
        />
      </Layer>
    </Stage>
  );
}
