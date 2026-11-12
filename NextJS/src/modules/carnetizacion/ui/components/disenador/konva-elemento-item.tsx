"use client";

import { Circle, Group, Image as KonvaImage, Line, Path, Rect, Text } from "react-konva";
import type Konva from "konva";

import type { ElementoKonva, PersonaMuestra } from "../../../domain/entities/disenador";

// Factor de conversión de puntos tipográficos pt a mm
const PT_A_MM = 0.3528;
const MIN_PT_AJUSTE = 3.5;

/** Ancho (px) de un texto con la tipografía dada; null si no hay canvas (SSR/tests). */
function medirTexto(texto: string, fuente: string): number | null {
  if (typeof document === "undefined") return null;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.font = fuente;
  return ctx.measureText(texto).width;
}

interface KonvaElementoItemProps {
  elemento: ElementoKonva;
  escala: number;
  anchoPx: number;
  altoPx: number;
  datosPersona: PersonaMuestra;
  coloresRegla: { primario: string; acento: string; texto: string };
  imagenesCargadas: Record<string, HTMLImageElement>;
  onSeleccionarElemento: (id: string | null, aditivo?: boolean) => void;
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
  // `sw` está en mm, igual que en el PDF (sw_mm * MM_A_PT).
  const bordeGrosor = (el.sw || 0) * escala;
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
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) =>
      onSeleccionarElemento(el.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey),
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

  // 3. Triángulo / Franja diagonal / Forma SVG personalizada
  if (el.t === "tri" || el.t === "diag") {
    const puntos =
      el.t === "tri"
        ? [w / 2, 0, w, h, 0, h]
        : el.diagr
          ? [w * 0.28, 0, w, 0, w, h, 0, h] // mismas formas que el PDF (diagr)
          : [0, 0, w, 0, w * 0.72, h, 0, h]; // diag
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

  // 3b. Forma libre definida por un SVG path en una caja de 0..100
  if (el.t === "path") {
    const datos = el.path || "M 0 0 H 100 V 100 H 0 Z";
    return (
      <Path
        key={el.id}
        {...propiedadesComunes}
        data={datos}
        scaleX={w / 100}
        scaleY={h / 100}
        fill={colorRelleno}
        stroke={bordeColor || undefined}
        strokeWidth={bordeGrosor}
        strokeScaleEnabled={false}
      />
    );
  }

  // 4. Texto o Campo Dinámico
  if (el.t === "text" || el.t === "field") {
    const textoMostrado = resolverTextoCampo(el, datosPersona);
    const multilinea = textoMostrado.includes("\n");
    let fuentePt = el.size || 8;
    // Igual que el PDF: si no cabe en el ancho, se reduce hasta un mínimo de 3.5 pt.
    if (!multilinea && textoMostrado) {
      const px = fuentePt * PT_A_MM * escala;
      const ancho = medirTexto(
        textoMostrado,
        `${el.bold ? "bold " : ""}${px}px ${el.font || "Source Sans 3, Arial, sans-serif"}`,
      );
      if (ancho && ancho > w) fuentePt = Math.max(MIN_PT_AJUSTE, fuentePt * (w / ancho));
    }
    const tamanoPx = fuentePt * PT_A_MM * escala;

    return (
      <Text
        key={el.id}
        {...propiedadesComunes}
        text={textoMostrado}
        width={w}
        height={h}
        verticalAlign="middle"
        lineHeight={multilinea ? 1.2 : 1}
        fontFamily={el.font || "Source Sans 3, Arial, sans-serif"}
        fontSize={tamanoPx}
        fontStyle={`${el.bold ? "bold" : ""} ${el.ital ? "italic" : ""}`.trim() || "normal"}
        align={el.align || "left"}
        fill={colorRelleno}
        wrap={multilinea ? "word" : "none"}
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
    // El PDF dibuja el QR como un cuadrado de lado min(w, h), anclado arriba a la izquierda.
    const lado = Math.min(w, h);
    return (
      <Group key={el.id} {...propiedadesComunes}>
        <Rect
          width={lado}
          height={lado}
          fill="#ffffff"
          stroke={bordeColor || "#cbd5e1"}
          strokeWidth={bordeGrosor || 1}
          cornerRadius={radio}
        />
        <Text
          text="[QR SEGURO]"
          width={lado}
          height={lado}
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
    // El PDF conserva la proporción de la imagen y la centra en la caja.
    let dx = 0;
    let dy = 0;
    let iw = w;
    let ih = h;
    if (img && img.width > 0 && img.height > 0) {
      const f = Math.min(w / img.width, h / img.height);
      iw = img.width * f;
      ih = img.height * f;
      dx = (w - iw) / 2;
      dy = (h - ih) / 2;
    }
    return (
      <Group key={el.id} {...propiedadesComunes}>
        {img ? (
          <KonvaImage image={img} x={dx} y={dy} width={iw} height={ih} />
        ) : (
          <>
            <Rect
              width={w}
              height={h}
              stroke={colorRelleno}
              strokeWidth={0.6}
              cornerRadius={1}
              fill="rgba(0,0,0,0)"
            />
            <Text
              text={el.biblioteca_id ? "" : el.etiqueta || "LOGO"}
              width={w}
              height={h}
              fontSize={Math.min(h * 0.45, 7)}
              fontStyle="bold"
              fontFamily="Source Sans 3, Arial, sans-serif"
              align="center"
              verticalAlign="middle"
              fill={colorRelleno}
            />
          </>
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

/** Códigos de campo del expediente/PDF que en PersonaMuestra tienen otro nombre. */
const ALIAS_CAMPOS: Record<string, string> = {
  nombre_completo: "nombre",
  departamento: "oficina",
  tipo_personal: "nomina",
};

function resolverTextoCampo(el: ElementoKonva, datosPersona: PersonaMuestra): string {
  if (el.t === "text") return el.text || "";
  if (el.t === "field" && el.field) {
    const clave = ALIAS_CAMPOS[el.field] ?? el.field;
    const valor = (datosPersona as unknown as Record<string, string | undefined>)[clave];
    return valor || `[${el.name}]`;
  }
  return el.name;
}
