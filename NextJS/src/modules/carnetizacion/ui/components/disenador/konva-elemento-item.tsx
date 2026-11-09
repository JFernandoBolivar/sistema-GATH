"use client";

import { Circle, Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";
import type Konva from "konva";

import type { ElementoKonva, PersonaMuestra } from "../../../domain/entities/disenador";

// Factor de conversión de puntos tipográficos pt a mm
const PT_A_MM = 0.3528;

interface KonvaElementoItemProps {
  elemento: ElementoKonva;
  escala: number;
  anchoPx: number;
  altoPx: number;
  datosPersona: PersonaMuestra;
  coloresRegla: { primario: string; acento: string; texto: string };
  imagenesCargadas: Record<string, HTMLImageElement>;
  onSeleccionarElemento: (id: string | null) => void;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
  onActualizarGuias: (guias: { x?: number; y?: number }) => void;
}

export function KonvaElementoItem({
  elemento: el,
  escala,
  anchoPx,
  altoPx,
  datosPersona,
  coloresRegla,
  imagenesCargadas,
  onSeleccionarElemento,
  onActualizarElemento,
  onActualizarGuias,
}: KonvaElementoItemProps) {
  const x = el.x * escala;
  const y = el.y * escala;
  const w = el.w * escala;
  const h = el.h * escala;
  const rotacion = el.r || 0;
  const opacidad = (el.op ?? 100) / 100;
  const radio = (el.rad || 0) * escala;
  const bordeColor = resolverColor(el.stroke || "", coloresRegla);
  const bordeGrosor = (el.sw || 0) * escala * 0.3528;
  const colorRelleno = resolverColor(el.fill, coloresRegla);
  const sombra = (el.shadow || 0) * 3;

  const propiedadesComunes = {
    id: `node-${el.id}`,
    x,
    y,
    rotation: rotacion,
    opacity: opacidad,
    shadowColor: "#000000",
    shadowBlur: sombra,
    shadowOpacity: sombra > 0 ? 0.25 : 0,
    shadowOffset: { x: sombra > 0 ? 2 : 0, y: sombra > 0 ? 3 : 0 },
    draggable: !el.bloqueado,
    onClick: () => onSeleccionarElemento(el.id),
    onTap: () => onSeleccionarElemento(el.id),
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      const centroX = anchoPx / 2;
      const centroY = altoPx / 2;
      const tolerance = 6;
      let nuevoX = e.target.x();
      let nuevoY = e.target.y();
      const guias: { x?: number; y?: number } = {};

      if (Math.abs(nuevoX + w / 2 - centroX) < tolerance) {
        nuevoX = centroX - w / 2;
        e.target.x(nuevoX);
        guias.x = centroX;
      }
      if (Math.abs(nuevoY + h / 2 - centroY) < tolerance) {
        nuevoY = centroY - h / 2;
        e.target.y(nuevoY);
        guias.y = centroY;
      }
      onActualizarGuias(guias);
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onActualizarGuias({});
      onActualizarElemento(el.id, {
        x: Number((e.target.x() / escala).toFixed(2)),
        y: Number((e.target.y() / escala).toFixed(2)),
      });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);

      onActualizarElemento(el.id, {
        x: Number((node.x() / escala).toFixed(2)),
        y: Number((node.y() / escala).toFixed(2)),
        w: Math.max(2, Number(((w * scaleX) / escala).toFixed(2))),
        h: Math.max(2, Number(((h * scaleY) / escala).toFixed(2))),
        r: Number(node.rotation().toFixed(1)),
      });
    },
  };

  // 1. Rectángulo
  if (el.t === "rect") {
    return (
      <Rect
        key={el.id}
        {...propiedadesComunes}
        width={w}
        height={h}
        fill={colorRelleno}
        cornerRadius={radio}
        stroke={bordeColor || undefined}
        strokeWidth={bordeGrosor}
      />
    );
  }

  // 2. Círculo
  if (el.t === "circle") {
    const radioCirculo = Math.min(w, h) / 2;
    return (
      <Circle
        key={el.id}
        {...propiedadesComunes}
        offsetX={-radioCirculo}
        offsetY={-radioCirculo}
        radius={radioCirculo}
        fill={colorRelleno}
        stroke={bordeColor || undefined}
        strokeWidth={bordeGrosor}
      />
    );
  }

  // 3. Triángulo / Franja diagonal
  if (el.t === "tri" || el.t === "diag") {
    const puntos =
      el.t === "tri"
        ? [w / 2, 0, w, h, 0, h]
        : [0, h * 0.4, w, 0, w, h * 0.6, 0, h];
    return (
      <Line
        key={el.id}
        {...propiedadesComunes}
        points={puntos}
        closed
        fill={colorRelleno}
        stroke={bordeColor || undefined}
        strokeWidth={bordeGrosor}
      />
    );
  }

  // 4. Texto o Campo Dinámico
  if (el.t === "text" || el.t === "field") {
    const textoMostrado = resolverTextoCampo(el, datosPersona);
    const fuentePt = el.size || 8;
    const tamanoPx = fuentePt * PT_A_MM * escala;

    return (
      <Text
        key={el.id}
        {...propiedadesComunes}
        text={textoMostrado}
        width={w}
        fontFamily={el.font || "Source Sans 3, Arial, sans-serif"}
        fontSize={tamanoPx}
        fontStyle={`${el.bold ? "bold" : ""} ${el.ital ? "italic" : ""}`.trim() || "normal"}
        align={el.align || "left"}
        fill={colorRelleno}
        wrap="word"
      />
    );
  }

  // 4. Fotografía Oficial del Titular
  if (el.t === "photo") {
    const imgCargada =
      (el.src && imagenesCargadas[el.src]) ||
      (datosPersona.foto_url && imagenesCargadas[datosPersona.foto_url]);
    return (
      <Group key={el.id} {...propiedadesComunes}>
        {imgCargada ? (
          <KonvaImage
            image={imgCargada}
            width={w}
            height={h}
            cornerRadius={radio}
            stroke={bordeColor || undefined}
            strokeWidth={bordeGrosor}
          />
        ) : (
          <>
            <Rect
              width={w}
              height={h}
              fill="#e2e8f0"
              cornerRadius={radio}
              stroke={bordeColor || "#cbd5e1"}
              strokeWidth={bordeGrosor || 1}
            />
            <Text
              text="FOTO"
              width={w}
              height={h}
              fontSize={11 * escala * PT_A_MM}
              fontFamily="sans-serif"
              fontStyle="bold"
              align="center"
              verticalAlign="middle"
              fill="#64748b"
            />
          </>
        )}
      </Group>
    );
  }

  // 5. Código QR Oficial
  if (el.t === "qr") {
    return (
      <Group key={el.id} {...propiedadesComunes}>
        <Rect
          width={w}
          height={h}
          fill="#ffffff"
          stroke={bordeColor || "#cbd5e1"}
          strokeWidth={bordeGrosor || 1}
          cornerRadius={radio}
        />
        <Text
          text="[QR SEGURO]"
          width={w}
          height={h}
          fontSize={7 * escala * PT_A_MM}
          fontFamily="monospace"
          fontStyle="bold"
          align="center"
          verticalAlign="middle"
          fill="#16264a"
        />
      </Group>
    );
  }

  // 6. Imagen de la Biblioteca (Logos, firmas, sellos)
  if (el.t === "image") {
    const img = el.src ? imagenesCargadas[el.src] : null;
    return (
      <Group key={el.id} {...propiedadesComunes}>
        {img ? (
          <KonvaImage
            image={img}
            width={w}
            height={h}
            cornerRadius={radio}
            stroke={bordeColor || undefined}
            strokeWidth={bordeGrosor}
          />
        ) : (
          <Rect
            width={w}
            height={h}
            fill="#f1f5f9"
            stroke="#94a3b8"
            strokeWidth={1}
            dash={[3, 3]}
            cornerRadius={radio}
          />
        )}
      </Group>
    );
  }

  return null;
}

function resolverColor(
  color: string,
  coloresRegla: { primario: string; acento: string; texto: string }
): string {
  if (!color) return "#111827";
  if (color === "rule:primario") return coloresRegla.primario;
  if (color === "rule:acento") return coloresRegla.acento;
  if (color === "rule:texto") return coloresRegla.texto;
  return color;
}

function resolverTextoCampo(el: ElementoKonva, datosPersona: PersonaMuestra): string {
  if (el.t === "text") return el.text || "";
  if (el.t === "field" && el.field) {
    const valor = (datosPersona as unknown as Record<string, string | undefined>)[el.field];
    return valor || `[${el.name}]`;
  }
  return el.name;
}
