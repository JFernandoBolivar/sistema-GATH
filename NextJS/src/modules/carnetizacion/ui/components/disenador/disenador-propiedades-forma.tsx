"use client";

import { useState } from "react";
import { Check, Link2, Link2Off, PenTool, Trash2 } from "lucide-react";

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
}

interface Props {
  elemento: ElementoKonva;
  control?: ControlForma;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
}

export const TIPOS_CON_FORMA = ["rect", "tri", "diag", "path"] as const;

/** Radio por esquina del rectángulo, con candado para «todas iguales». */
function RadiosRectangulo({ elemento: el, onActualizarElemento }: Omit<Props, "control">) {
  const radios = radiosEsquinasMm(el);
  const [candado, setCandado] = useState(radios.every((r) => r === radios[0]));
  const etiquetas = ["Sup. izquierda", "Sup. derecha", "Inf. derecha", "Inf. izquierda"];

  const cambiar = (i: number, texto: string) => {
    const valor = Math.max(0, parseFloat(texto) || 0);
    const nuevos: [number, number, number, number] = candado
      ? [valor, valor, valor, valor]
      : (radios.map((r, k) => (k === i ? valor : r)) as [number, number, number, number]);
    onActualizarElemento(el.id, { radios: nuevos, rad: candado ? valor : el.rad });
  };

  return (
    <SeccionPropiedades titulo="Radio de las esquinas">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {candado ? "Todas iguales" : "Una por esquina"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-pressed={candado}
          title={candado ? "Desbloquear: un radio por esquina" : "Bloquear: todas iguales"}
          onClick={() => {
            const siguiente = !candado;
            setCandado(siguiente);
            if (siguiente) {
              const v = radios[0];
              onActualizarElemento(el.id, { radios: [v, v, v, v], rad: v });
            }
          }}
        >
          {candado ? <Link2 className="size-3.5" /> : <Link2Off className="size-3.5" />}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(candado ? [0] : [0, 1, 2, 3]).map((i) => (
          <CampoNumerico
            key={i}
            etiqueta={candado ? "Todas" : etiquetas[i]}
            sufijo="mm"
            step="0.5"
            min="0"
            value={radios[i]}
            onChange={(e) => cambiar(i, e.target.value)}
          />
        ))}
      </div>
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
      {el.t === "rect" && (
        <RadiosRectangulo elemento={el} onActualizarElemento={onActualizarElemento} />
      )}

      {(el.t === "tri" || el.t === "diag" || el.t === "path") && control && (
        <SeccionPropiedades titulo="Forma">
          {editando ? (
            <EdicionPuntos elemento={el} control={control} />
          ) : (
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
          )}
        </SeccionPropiedades>
      )}

      {el.t === "path" && !editando && (
        <CodigoSvgAvanzado elemento={el} control={control} onActualizarElemento={onActualizarElemento} />
      )}
    </>
  );
}
