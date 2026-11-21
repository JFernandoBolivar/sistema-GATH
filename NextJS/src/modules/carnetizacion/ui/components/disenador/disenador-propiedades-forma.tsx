"use client";

import { useState } from "react";
import {
  Check,
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  Link2,
  Link2Off,
  PenTool,
  Shapes,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { ElementoKonva } from "../../../domain/entities/disenador";
import {
  generarPathDesdePuntos,
  radioMaximoMm,
  radiosEsquinasMm,
  validarPathSvg,
} from "../../../domain/entities/forma-puntos";
import { CampoNumerico, SeccionPropiedades } from "./disenador-campos";
import { colorParaMiniatura, MiniaturaForma } from "./miniatura-forma";

/** Lo que el inspector necesita para el modo «Editar puntos» (lo provee el editor). */
export interface ControlForma {
  edicionPuntos: { id: string; indice: number | null } | null;
  onEditarPuntos: (id: string) => void;
  onTerminarEdicion: () => void;
  onCambiarRadioPunto: (indice: number, r: number) => void;
  onEliminarPunto: () => void;
  onConvertirAPathLibre: (id: string) => void;
  /** Rectángulo o círculo → forma libre y entra en «Editar puntos». */
  onConvertirEnFormaLibre: (id: string) => void;
}

interface Props {
  elemento: ElementoKonva;
  control?: ControlForma;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
}

export const TIPOS_CON_FORMA = ["rect", "circle", "photo", "qr", "tri", "diag", "path"] as const;

const VALORES_RAPIDOS_MM = [0, 1, 2, 4] as const;
const ICONOS_ESQUINA = [CornerUpLeft, CornerUpRight, CornerDownRight, CornerDownLeft];

/** Vista previa en vivo: un cuadro con las esquinas tal como quedarán (radios en mm). */
function VistaPreviaEsquinas({ el, radios }: { el: ElementoKonva; radios: readonly number[] }) {
  // Caja de 44 × 44 px: la forma conserva la proporción y cada mm se escala igual.
  const lado = 44;
  const mayor = Math.max(el.w, el.h, 1);
  const pw = (el.w / mayor) * lado;
  const ph = (el.h / mayor) * lado;
  const k = lado / mayor;
  const [a, b, c, d] = radios.map((r) => Math.min(r * k, pw / 2, ph / 2));
  const x0 = (lado - pw) / 2;
  const y0 = (lado - ph) / 2;
  const trazo =
    `M ${x0 + a} ${y0} H ${x0 + pw - b} Q ${x0 + pw} ${y0} ${x0 + pw} ${y0 + b} ` +
    `V ${y0 + ph - c} Q ${x0 + pw} ${y0 + ph} ${x0 + pw - c} ${y0 + ph} ` +
    `H ${x0 + d} Q ${x0} ${y0 + ph} ${x0} ${y0 + ph - d} V ${y0 + a} Q ${x0} ${y0} ${x0 + a} ${y0} Z`;
  return (
    <svg
      width={lado}
      height={lado}
      viewBox={`0 0 ${lado} ${lado}`}
      role="img"
      aria-label="Vista previa de las esquinas"
      className="shrink-0 rounded-md border bg-muted/30"
    >
      <path d={trazo} className="fill-primary/25 stroke-primary" strokeWidth={1.5} />
    </svg>
  );
}

/**
 * Radio de las esquinas: valores rápidos, deslizador con vista previa en vivo y, en el
 * rectángulo, candado «todas iguales / cada esquina» con un icono por esquina.
 */
function RadiosEsquinas({ elemento: el, onActualizarElemento }: Omit<Props, "control">) {
  const porEsquina = el.t === "rect";
  const radios = porEsquina ? radiosEsquinasMm(el) : ([el.rad || 0, el.rad || 0, el.rad || 0, el.rad || 0] as const);
  const [candado, setCandado] = useState(radios.every((r) => r === radios[0]));
  const [vivo, setVivo] = useState<number | null>(null);
  const etiquetas = ["Sup. izquierda", "Sup. derecha", "Inf. derecha", "Inf. izquierda"];
  const tope = Math.max(0.5, Math.min(el.w, el.h) / 2);
  const todas = vivo ?? radios[0];
  const radiosVista = vivo !== null && candado ? [vivo, vivo, vivo, vivo] : radios;

  const aplicarTodas = (valor: number) => {
    const v = Math.max(0, valor);
    onActualizarElemento(el.id, porEsquina ? { radios: [v, v, v, v], rad: v } : { rad: v });
  };

  const cambiar = (i: number, texto: string) => {
    const valor = Math.max(0, parseFloat(texto) || 0);
    if (candado) return aplicarTodas(valor);
    const nuevos = radios.map((r, k) => (k === i ? valor : r)) as [number, number, number, number];
    onActualizarElemento(el.id, { radios: nuevos, rad: el.rad });
  };

  return (
    <SeccionPropiedades titulo="Radio de las esquinas">
      <div className="flex items-center gap-3">
        <VistaPreviaEsquinas el={el} radios={radiosVista} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{candado ? "Todas iguales" : "Una por esquina"}</span>
            <span className="font-mono">{todas.toFixed(1)} mm</span>
          </div>
          <div className="flex gap-1" role="group" aria-label="Valores rápidos de radio">
            {VALORES_RAPIDOS_MM.map((v) => (
              <Button
                key={v}
                type="button"
                variant={candado && radios[0] === v ? "default" : "outline"}
                size="sm"
                className="h-7 flex-1 px-0 text-[11px]"
                aria-label={v === 0 ? "Esquinas vivas, 0 milímetros" : `Radio de ${v} milímetros`}
                onClick={() => aplicarTodas(v)}
              >
                {v}
              </Button>
            ))}
            {porEsquina && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-pressed={candado}
                title={candado ? "Desbloquear: un radio por esquina" : "Bloquear: todas iguales"}
                aria-label={candado ? "Desbloquear: un radio por esquina" : "Bloquear: todas iguales"}
                onClick={() => {
                  const siguiente = !candado;
                  setCandado(siguiente);
                  if (siguiente) aplicarTodas(radios[0]);
                }}
              >
                {candado ? <Link2 className="size-3.5" /> : <Link2Off className="size-3.5" />}
              </Button>
            )}
          </div>
        </div>
      </div>
      {candado ? (
        <Slider
          aria-label="Radio de las esquinas"
          min={0}
          max={tope}
          step={0.5}
          value={[Math.min(todas, tope)]}
          onValueChange={([v]) => setVivo(v)}
          onValueCommit={([v]) => {
            setVivo(null);
            aplicarTodas(v);
          }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => {
            const Icono = ICONOS_ESQUINA[i];
            return (
              <div key={i} className="flex items-end gap-1">
                <Icono className="mb-2 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <CampoNumerico
                  etiqueta={etiquetas[i]}
                  sufijo="mm"
                  step="0.5"
                  min="0"
                  value={radios[i]}
                  onChange={(e) => cambiar(i, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}
    </SeccionPropiedades>
  );
}

/** Código SVG: plegado, con validación en vivo y miniatura. */
export function CodigoSvgAvanzado({ elemento: el, control, onActualizarElemento }: Props) {
  const [borrador, setBorrador] = useState<{ id: string; texto: string } | null>(null);
  const generadoDesdePuntos = !!el.puntos;
  const textoGuardado = el.puntos ? generarPathDesdePuntos(el.puntos, el.w, el.h) : (el.path ?? "");
  const texto = !generadoDesdePuntos && borrador?.id === el.id ? borrador.texto : textoGuardado;
  const validacion = validarPathSvg(texto);
  const color = colorParaMiniatura(el.fill);

  const alEscribir = (nuevo: string) => {
    setBorrador({ id: el.id, texto: nuevo });
    // Un código inválido no se aplica: la forma conserva la última versión válida.
    if (validarPathSvg(nuevo).valido) onActualizarElemento(el.id, { path: nuevo.trim() });
  };

  return (
    <details className="group rounded-md border border-border">
      <summary className="cursor-pointer select-none px-2.5 py-2 text-xs font-medium text-muted-foreground">
        Avanzado (código SVG)
      </summary>
      <div className="space-y-2 border-t p-2.5">
        <div className="flex items-start gap-2">
          <textarea
            aria-label="Código SVG de la forma (caja 0–100)"
            aria-invalid={!validacion.valido}
            className={`h-24 min-w-0 flex-1 resize-none rounded-md border bg-background p-2 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-1 ${
              validacion.valido
                ? "border-input focus:ring-ring"
                : "border-destructive focus:ring-destructive"
            } ${generadoDesdePuntos ? "text-muted-foreground" : ""}`}
            value={texto}
            readOnly={generadoDesdePuntos}
            onChange={(e) => alEscribir(e.target.value)}
            placeholder="M 0 0 H 100 V 40 C 70 60 30 20 0 50 Z"
            spellCheck={false}
          />
          <MiniaturaForma
            path={validacion.valido ? texto : textoGuardado}
            color={color}
            proporcion={el.h > 0 ? el.w / el.h : 1}
            className="shrink-0 rounded border bg-muted/30"
          />
        </div>
        {!validacion.valido && (
          <p role="alert" className="text-[11px] font-medium text-destructive">
            {validacion.mensaje}
          </p>
        )}
        {generadoDesdePuntos ? (
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground">
              Generado desde los puntos (solo lectura). Para escribirlo a mano hay que dejar de usar puntos.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                if (
                  window.confirm(
                    "La forma pasará a ser un path libre y ya no podrás moverle los puntos. ¿Continuar?",
                  )
                ) {
                  control?.onConvertirAPathLibre(el.id);
                }
              }}
            >
              Editar como código
            </Button>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Solo M, L, H, V, C, Q y Z con números. Se escala al ancho y alto del elemento.
          </p>
        )}
      </div>
    </details>
  );
}

/** Radio del vértice seleccionado y acciones del modo «Editar puntos». */
function EdicionPuntos({ elemento: el, control }: { elemento: ElementoKonva; control: ControlForma }) {
  const indice = control.edicionPuntos?.indice ?? null;
  const puntos = el.puntos ?? [];
  const [vivo, setVivo] = useState<{ i: number; v: number } | null>(null);
  const maximo = indice === null ? 0 : radioMaximoMm(puntos, indice, el.w, el.h);
  const actual = indice === null ? 0 : puntos[indice]?.r ?? 0;
  const valor = vivo && vivo.i === indice ? vivo.v : actual;

  return (
    <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-2.5">
      <p className="text-[11px] leading-snug text-muted-foreground">
        Arrastra los puntos. Clic en un borde agrega un punto; Supr o Retroceso quita el seleccionado
        (mínimo 3). Esc o «Listo» para salir.
      </p>
      {indice === null ? (
        <p className="text-[11px] font-medium">Selecciona un punto para curvar su esquina.</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">
              Radio del punto {indice + 1} de {puntos.length}
            </Label>
            <span className="font-mono text-[11px]">{valor.toFixed(1)} mm</span>
          </div>
          <Slider
            min={0}
            max={Math.max(maximo, 0.1)}
            step={0.1}
            value={[Math.min(valor, Math.max(maximo, 0.1))]}
            disabled={maximo <= 0}
            onValueChange={([v]) => setVivo({ i: indice, v })}
            onValueCommit={([v]) => {
              setVivo(null);
              control.onCambiarRadioPunto(indice, v);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1.5 text-xs text-destructive"
            disabled={puntos.length <= 3}
            onClick={control.onEliminarPunto}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Quitar este punto
          </Button>
        </div>
      )}
      <Button type="button" size="sm" className="h-8 w-full gap-1.5 text-xs" onClick={control.onTerminarEdicion}>
        <Check className="size-3.5" aria-hidden />
        Listo
      </Button>
    </div>
  );
}

/** Edición de la forma del elemento: radios del rectángulo, «Editar puntos» y código SVG avanzado. */
export function DisenadorPropiedadesForma({ elemento: el, control, onActualizarElemento }: Props) {
  const editando = control?.edicionPuntos?.id === el.id;
  return (
    <>
      {(el.t === "rect" || el.t === "photo" || el.t === "qr") && (
        <RadiosEsquinas elemento={el} onActualizarElemento={onActualizarElemento} />
      )}

      {(el.t === "rect" || el.t === "circle") && control && (
        <SeccionPropiedades titulo="Forma">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full justify-start gap-2 text-xs"
            onClick={() => control.onConvertirEnFormaLibre(el.id)}
          >
            <Shapes className="size-4" aria-hidden />
            Convertir en forma libre (editar puntos)
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Arrastra los puntos para cambiar la forma. Se conservan color, borde y tamaño.
          </p>
        </SeccionPropiedades>
      )}

      {(el.t === "tri" || el.t === "diag" || el.t === "path") && control && (
        <SeccionPropiedades titulo="Forma">
          {editando ? (
            <EdicionPuntos elemento={el} control={control} />
          ) : (
            <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full justify-start gap-2 text-xs"
              onClick={() => control.onEditarPuntos(el.id)}
            >
              <PenTool className="size-4" aria-hidden />
              Editar puntos
            </Button>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Arrastra los puntos para cambiar la forma; cada punto puede tener su esquina redondeada.
            </p>
            </>
          )}
        </SeccionPropiedades>
      )}

      {el.t === "path" && !editando && (
        <CodigoSvgAvanzado elemento={el} control={control} onActualizarElemento={onActualizarElemento} />
      )}
    </>
  );
}
