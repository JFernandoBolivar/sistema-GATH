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
}

interface PlantillaMiniaturaProps {
  definicion: Record<string, unknown>;
  anchoMm: number;
  altoMm: number;
  etiqueta: string;
}

type Reglas = {
  primario: string;
  acento: string;
  texto: string;
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
  return color || "#e2e8f0";
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

function elementosDe(definicion: Record<string, unknown>): ElementoPlano[] {
  const konva = definicion.elementos;
  if (Array.isArray(konva)) {
    return konva
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
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
      }));
  }

  const anverso = definicion.anverso;
  if (Array.isArray(anverso)) {
    return anverso
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .map((e) => {
        const props = (e.props ?? {}) as Record<string, unknown>;
        return {
          t: String(e.tipo ?? "rect"),
          x: Number(e.x ?? 0),
          y: Number(e.y ?? 0),
          w: Number(e.w ?? 10),
          h: Number(e.h ?? 10),
          fill: String(props.fill ?? e.color ?? ""),
          texto:
            typeof e.texto === "string"
              ? e.texto
              : typeof e.campo === "string"
                ? e.campo
                : undefined,
          size: typeof e.fontSize === "number" ? e.fontSize : 6,
          align: e.align === "center" || e.align === "right" ? e.align : "left",
          rad: typeof props.rad === "number" ? props.rad : 0,
        };
      });
  }

  return [];
}

/** Miniatura SVG del anverso de una plantilla del motor (sin Konva). */
export function PlantillaMiniatura({
  definicion,
  anchoMm,
  altoMm,
  etiqueta,
}: PlantillaMiniaturaProps) {
  const reglas = leerReglas(definicion);
  const elementos = elementosDe(definicion);
  const ancho = anchoMm > 0 ? anchoMm : 54;
  const alto = altoMm > 0 ? altoMm : 85.6;
  const estilo: CSSProperties = { aspectRatio: `${ancho} / ${alto}` };

  return (
    <div
      className="mx-auto h-48 w-auto overflow-hidden rounded-md border border-border bg-white"
      style={estilo}
    >
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="size-full"
        role="img"
        aria-label={`Vista previa de ${etiqueta}`}
      >
        <rect x={0} y={0} width={ancho} height={alto} fill="#ffffff" />
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

          if (el.t === "rect") {
            return (
              <rect
                key={clave}
                x={el.x}
                y={el.y}
                width={el.w}
                height={el.h}
                rx={el.rad ?? 0}
                fill={fill}
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
            return (
              <polygon
                key={clave}
                points={`${el.x},${el.y + el.h * 0.4} ${el.x + el.w},${el.y} ${el.x + el.w},${el.y + el.h * 0.6} ${el.x},${el.y + el.h}`}
                fill={fill}
              />
            );
          }
          if (el.t === "line" || el.t === "signline") {
            return (
              <line
                key={clave}
                x1={el.x}
                y1={el.y}
                x2={el.x + el.w}
                y2={el.y + el.h}
                stroke={fill}
                strokeWidth={0.4}
              />
            );
          }
          if (el.t === "photo" || el.t === "qr" || el.t === "image") {
            return (
              <g key={clave}>
                <rect
                  x={el.x}
                  y={el.y}
                  width={el.w}
                  height={el.h}
                  rx={el.rad ?? 0}
                  fill={el.t === "qr" ? "#ffffff" : "#e2e8f0"}
                  stroke="#cbd5e1"
                  strokeWidth={0.3}
                />
                <text
                  x={el.x + el.w / 2}
                  y={el.y + el.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.max(2.4, el.w / 4)}
                  fill="#64748b"
                >
                  {el.t === "qr" ? "QR" : el.t === "photo" ? "FOTO" : "IMG"}
                </text>
              </g>
            );
          }
          if (el.t === "text" || el.t === "field") {
            const tamano = Math.max(2.4, Math.min((el.size ?? 6) * 0.3528, 10));
            const texto = el.texto
              ? el.texto.length > 26
                ? `${el.texto.slice(0, 26)}…`
                : el.texto
              : "";
            const ancla =
              el.align === "center" ? "middle" : el.align === "right" ? "end" : "start";
            const x =
              el.align === "center"
                ? el.x + el.w / 2
                : el.align === "right"
                  ? el.x + el.w
                  : el.x;
            return (
              <text
                key={clave}
                x={x}
                y={el.y + tamano}
                textAnchor={ancla}
                fontSize={tamano}
                fill={fill || "#111827"}
                fontFamily="Source Sans 3, Arial, sans-serif"
              >
                {texto}
              </text>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}
