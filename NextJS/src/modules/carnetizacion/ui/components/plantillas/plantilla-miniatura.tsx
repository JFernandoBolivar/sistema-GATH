"use client";

import type { CSSProperties } from "react";

interface ElementoPlano {
  t: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  texto?: string;
  size?: number;
  align?: "left" | "center" | "right";
  rad?: number;
  bold?: boolean;
  stroke?: string;
  sw?: number;
  label?: string;
  asset?: string;
}

interface PlantillaMiniaturaProps {
  definicion: Record<string, unknown>;
  anchoMm: number;
  altoMm: number;
  etiqueta: string;
  cara?: "anverso" | "reverso";
}

type Reglas = {
  primario: string;
  acento: string;
  texto: string;
};

const PT_A_MM = 25.4 / 72;
/** Mismo color por defecto que el PDF para elementos sin color (carnet_pdf.py). */
const COLOR_DEFECTO_PDF = "#1f3a5f";
const ASSETS_PUBLICOS: Record<string, string> = {
  "logo01.png": "/logo1.png",
  "logo02.png": "/logo2.png",
  "cintillo2.png": "/cintillo2.png",
};

const REGLAS_DEFECTO: Reglas = {
  primario: "#1f3a5f",
  acento: "#1273bd",
  texto: "#ffffff",
};

function resolverColor(valor: unknown, reglas: Reglas): string {
  const color = typeof valor === "string" ? valor : "";
  if (color === "rule:primario") return reglas.primario;
  if (color === "rule:acento") return reglas.acento;
  if (color === "rule:texto") return reglas.texto;
  return color || COLOR_DEFECTO_PDF;
}

function leerReglas(definicion: Record<string, unknown>): Reglas {
  const reglas = definicion.reglas as Record<string, unknown> | undefined;
  const reglasColor = definicion.reglas_color as Record<string, unknown> | undefined;
  const respaldo = (reglas?.respaldo ?? reglasColor?.respaldo ?? {}) as Record<string, unknown>;
  return {
    primario: typeof respaldo.primario === "string" ? respaldo.primario : REGLAS_DEFECTO.primario,
    acento: typeof respaldo.acento === "string" ? respaldo.acento : REGLAS_DEFECTO.acento,
    texto: typeof respaldo.texto === "string" ? respaldo.texto : REGLAS_DEFECTO.texto,
  };
}

function elementosDe(
  definicion: Record<string, unknown>,
  cara: "anverso" | "reverso",
): ElementoPlano[] {
  const konva = definicion.elementos;
  if (Array.isArray(konva)) {
    return konva
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .filter((e) => !e.cara || e.cara === cara)
      .map((e) => ({
        t: String(e.t ?? e.tipo ?? "rect"),
        x: Number(e.x ?? 0),
        y: Number(e.y ?? 0),
        w: Number(e.w ?? 10),
        h: Number(e.h ?? 10),
        fill: String(e.fill ?? ""),
        texto: typeof e.text === "string" ? e.text : undefined,
        size: typeof e.size === "number" ? e.size : undefined,
        align: e.align === "center" || e.align === "right" ? e.align : "left",
        rad: typeof e.rad === "number" ? e.rad : 0,
        bold: Boolean(e.bold),
      }));
  }

  const capa = definicion[cara] ?? definicion.anverso;
  if (Array.isArray(capa)) {
    return capa
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .map((e) => {
        const props = (e.props ?? {}) as Record<string, unknown>;
        const tipo = String(e.tipo ?? "rect");
        const nombre = typeof e.nombre === "string" ? e.nombre : undefined;
        return {
          t: tipo,
          x: Number(e.x ?? 0),
          y: Number(e.y ?? 0),
          w: Number(e.w ?? 10),
          h: Number(e.h ?? 10),
          // Igual que el PDF: fill > props.fill > color; si no hay, azul institucional.
          fill: String(e.fill ?? props.fill ?? e.color ?? ""),
          // Un campo del expediente sin datos muestra su nombre, no el código técnico.
          texto:
            tipo === "field"
              ? (nombre ?? (typeof e.campo === "string" ? e.campo : undefined))
              : typeof e.texto === "string"
                ? e.texto
                : undefined,
          size: typeof e.fontSize === "number" ? e.fontSize : 7.5,
          align: e.align === "center" || e.align === "right" ? e.align : "left",
          rad: Number(e.rad ?? props.rad ?? e.radius ?? 0) || 0,
          bold: Boolean(e.bold),
          stroke: typeof props.stroke === "string" ? props.stroke : undefined,
          sw: Number(e.sw ?? props.sw ?? 0) || 0,
          label: typeof props.label === "string" ? props.label : nombre,
          asset: typeof props.asset === "string" ? props.asset : undefined,
        };
      });
  }

  return [];
}

/** Miniatura SVG de una cara de una plantilla del motor, con las mismas reglas que el PDF. */
export function PlantillaMiniatura({
  definicion,
  anchoMm,
  altoMm,
  etiqueta,
  cara = "anverso",
}: PlantillaMiniaturaProps) {
  const reglas = leerReglas(definicion);
  const elementos = elementosDe(definicion, cara);
  const ancho = anchoMm > 0 ? anchoMm : 54;
  const alto = altoMm > 0 ? altoMm : 85.6;
  const estilo: CSSProperties = { aspectRatio: `${ancho} / ${alto}` };
  const fondoConfig = (definicion.bg as Record<string, unknown> | undefined)?.[cara];
  const fondo = typeof fondoConfig === "string" ? fondoConfig : "#ffffff";

  return (
    <div
      className="mx-auto h-52 w-auto overflow-hidden rounded-md border border-border bg-white"
      style={estilo}
    >
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="size-full"
        role="img"
        aria-label={`Vista previa de ${etiqueta} (${cara})`}
      >
        <rect x={0} y={0} width={ancho} height={alto} fill={fondo} />
        {elementos.length === 0 && (
          <>
            <rect x={0} y={0} width={ancho} height={alto} fill="#f1f5f9" />
            <text
              x={ancho / 2}
              y={alto / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={4}
              fill="#64748b"
              fontFamily="Source Sans 3, Arial, sans-serif"
            >
              Sin capas
            </text>
          </>
        )}
        {elementos.map((el, indice) => {
          const fill = resolverColor(el.fill, reglas);
          const clave = `${el.t}-${indice}`;

          if (el.t === "rect" || el.t === "forma") {
            const conBorde = !!el.sw && !!el.stroke;
            return (
              <rect
                key={clave}
                x={el.x}
                y={el.y}
                width={el.w}
                height={el.h}
                rx={el.rad ?? 0}
                fill={fill}
                stroke={conBorde ? el.stroke : undefined}
                strokeWidth={conBorde ? el.sw : undefined}
              />
            );
          }
          if (el.t === "circle" || el.t === "ellipse") {
            return (
              <ellipse
                key={clave}
                cx={el.x + el.w / 2}
                cy={el.y + el.h / 2}
                rx={el.w / 2}
                ry={el.h / 2}
                fill={fill}
              />
            );
          }
          if (el.t === "tri") {
            return (
              <polygon
                key={clave}
                points={`${el.x + el.w / 2},${el.y} ${el.x + el.w},${el.y + el.h} ${el.x},${el.y + el.h}`}
                fill={fill}
              />
            );
          }
          if (el.t === "diag" || el.t === "diagr") {
            // Mismas formas que el PDF: diag recorta abajo a la derecha; diagr, arriba a la izquierda.
            const puntos =
              el.t === "diag"
                ? `${el.x},${el.y} ${el.x + el.w},${el.y} ${el.x + el.w * 0.72},${el.y + el.h} ${el.x},${el.y + el.h}`
                : `${el.x + el.w * 0.28},${el.y} ${el.x + el.w},${el.y} ${el.x + el.w},${el.y + el.h} ${el.x},${el.y + el.h}`;
            return <polygon key={clave} points={puntos} fill={fill} />;
          }
          if (el.t === "line" || el.t === "signline") {
            // El PDF dibuja una línea horizontal centrada en la caja, de grosor h (mín. 0,4 pt).
            const grosor = Math.max(el.h, 0.4 * PT_A_MM);
            return (
              <line
                key={clave}
                x1={el.x}
                y1={el.y + el.h / 2}
                x2={el.x + el.w}
                y2={el.y + el.h / 2}
                stroke={fill}
                strokeWidth={grosor}
              />
            );
          }
          if (el.t === "image") {
            const src = el.asset ? ASSETS_PUBLICOS[el.asset] : undefined;
            if (src) {
              return (
                <image
                  key={clave}
                  href={src}
                  x={el.x}
                  y={el.y}
                  width={el.w}
                  height={el.h}
                  preserveAspectRatio="xMidYMid meet"
                />
              );
            }
            // Sin asset el PDF dibuja un marcador con borde y su etiqueta (LOGO, FIRMA...).
            return (
              <g key={clave}>
                <rect
                  x={el.x}
                  y={el.y}
                  width={el.w}
                  height={el.h}
                  rx={0.35}
                  fill="none"
                  stroke={fill}
                  strokeWidth={0.2}
                />
                <text
                  x={el.x + el.w / 2}
                  y={el.y + el.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(el.h * 0.45, 7 * PT_A_MM)}
                  fontWeight="bold"
                  fill={fill}
                  fontFamily="Source Sans 3, Arial, sans-serif"
                >
                  {el.label ?? "LOGO"}
                </text>
              </g>
            );
          }
          if (el.t === "photo" || el.t === "qr") {
            // El PDF dibuja el QR como cuadrado de lado min(w, h).
            const lado = Math.min(el.w, el.h);
            const w = el.t === "qr" ? lado : el.w;
            const h = el.t === "qr" ? lado : el.h;
            return (
              <g key={clave}>
                <rect
                  x={el.x}
                  y={el.y}
                  width={w}
                  height={h}
                  rx={el.rad ?? 0}
                  fill={el.t === "qr" ? "#ffffff" : "#e2e8f0"}
                  stroke="#cbd5e1"
                  strokeWidth={0.3}
                />
                <text
                  x={el.x + w / 2}
                  y={el.y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.max(2.4, w / 4)}
                  fill="#64748b"
                >
                  {el.t === "qr" ? "QR" : "FOTO"}
                </text>
              </g>
            );
          }
          if (el.t === "text" || el.t === "field") {
            const lineas = (el.texto ?? "").split("\n");
            const pt0 = el.size ?? 7.5;
            // Ajuste como el PDF: si no cabe en el ancho, se reduce hasta 3,5 pt (ancho estimado).
            const factor = el.bold ? 0.56 : 0.5;
            const largo = Math.max(...lineas.map((l) => l.length), 1);
            const anchoTexto = largo * pt0 * PT_A_MM * factor;
            const pt =
              lineas.length === 1 && anchoTexto > el.w
                ? Math.max(3.5, pt0 * (el.w / anchoTexto))
                : pt0;
            const tamano = pt * PT_A_MM;
            const ancla =
              el.align === "center" ? "middle" : el.align === "right" ? "end" : "start";
            const x =
              el.align === "center"
                ? el.x + el.w / 2
                : el.align === "right"
                  ? el.x + el.w
                  : el.x;
            // Origen vertical como el PDF: bloque centrado en la caja (no pegado arriba).
            const interlineado = tamano * 1.2;
            const y0 =
              lineas.length > 1
                ? el.y + (el.h - lineas.length * interlineado) / 2 + tamano
                : el.y + (el.h + tamano) / 2 - 0.5 * PT_A_MM;
            return (
              <text
                key={clave}
                textAnchor={ancla}
                fontSize={tamano}
                fontWeight={el.bold ? "bold" : "normal"}
                fill={fill}
                fontFamily="Source Sans 3, Arial, sans-serif"
              >
                {lineas.map((linea, i) => (
                  <tspan key={i} x={x} y={y0 + i * interlineado}>
                    {linea}
                  </tspan>
                ))}
              </text>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}
