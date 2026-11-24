"use client";

import { Copy, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  AlineacionCorta,
  CampoOverlay,
  OperadorCondicion,
} from "../../domain/entities/plantilla";
import { LIMITES } from "../../domain/lib/esquemas";
import { ETIQUETAS_CAMPO_OVERLAY } from "../../domain/lib/factorias";
import { limitarCampoALaPagina, type DimensionPagina } from "../../domain/lib/lienzo";
import { columnasDeColeccion } from "../../domain/lib/variables";
import type { EntornoEditor } from "../lib/entorno";
import { ETIQUETA_ALINEACION, ETIQUETA_OPERADOR } from "../lib/etiquetas";
import { CampoForm } from "./campo-form";
import { InputNumero } from "./input-numero";
import { SelectorVariable } from "./selector-variable";
import { SelectSimple } from "./select-simple";
import { TextoConVariables } from "./texto-con-variables";

interface Props {
  campo: CampoOverlay;
  /** Prefijo de ruta de error: `paginas.<p>.campos.<i>`. */
  ruta: string;
  pagina: DimensionPagina;
  entorno: EntornoEditor;
  onCambio: (cambios: Partial<CampoOverlay>) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
}

const ALINEACIONES = (["izquierda", "centro", "derecha"] as AlineacionCorta[]).map((v) => ({ valor: v, etiqueta: ETIQUETA_ALINEACION[v] }));
const OPERADORES = (Object.keys(ETIQUETA_OPERADOR) as OperadorCondicion[]).map((v) => ({ valor: v, etiqueta: ETIQUETA_OPERADOR[v] }));

/** Propiedades del campo seleccionado sobre el PDF (modo pdf_overlay). */
export function PropiedadesCampo({ campo, ruta, pagina, entorno, onCambio, onDuplicar, onEliminar }: Props) {
  const ro = entorno.soloLectura;
  const err = (sub: string) => entorno.errores[`${ruta}.${sub}`];
  const p = `pc-${campo.id}`;

  const geom = (k: "x" | "y" | "w" | "h", n: number) => {
    const l = limitarCampoALaPagina({ ...campo, [k]: n }, pagina);
    onCambio({ x: l.x, y: l.y, w: l.w, h: l.h });
  };

  return (
    <div className="grid gap-4" data-testid="propiedades-campo">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{ETIQUETAS_CAMPO_OVERLAY[campo.tipo]}</h3>
        {!ro && (
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" onClick={onDuplicar}>
              <Copy aria-hidden /> Duplicar
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={onEliminar}>
              <Trash2 aria-hidden /> Eliminar
            </Button>
          </div>
        )}
      </div>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-sm font-medium">Posición y tamaño (mm)</legend>
        {(["x", "y", "w", "h"] as const).map((k) => (
          <CampoForm key={k} id={`${p}-${k}`} etiqueta={{ x: "Izquierda (x)", y: "Arriba (y)", w: "Ancho", h: "Alto" }[k]} error={err(k)}>
            <InputNumero id={`${p}-${k}`} valor={campo[k]} paso={0.5} min={k === "w" || k === "h" ? 1 : 0} deshabilitado={ro} invalido={Boolean(err(k))} onCambio={(n) => geom(k, n)} />
          </CampoForm>
        ))}
        <p className="col-span-2 text-xs text-muted-foreground">
          Página de {pagina.ancho_mm.toFixed(0)} × {pagina.alto_mm.toFixed(0)} mm. Con el campo elegido, las flechas lo mueven 0,5 mm (Mayús: 5 mm).
        </p>
      </fieldset>

      {campo.tipo === "texto" && (
        <>
          <CampoForm id={`${p}-texto`} etiqueta="Texto" error={err("texto")}>
            <TextoConVariables id={`${p}-texto`} valor={campo.texto} entorno={entorno} onCambio={(t) => onCambio({ texto: t })} error={err("texto")} filas={3} />
          </CampoForm>
          <div className="grid grid-cols-2 gap-2">
            <CampoForm id={`${p}-tam`} etiqueta="Tamaño de letra (pt)" error={err("tamano")}>
              <InputNumero id={`${p}-tam`} valor={campo.tamano} paso={0.5} min={LIMITES.TAMANO_FUENTE[0]} max={LIMITES.TAMANO_FUENTE[1]} deshabilitado={ro} onCambio={(n) => onCambio({ tamano: n })} />
            </CampoForm>
            <CampoForm id={`${p}-alin`} etiqueta="Alineación" error={err("alineacion")}>
              <SelectSimple id={`${p}-alin`} valor={campo.alineacion} deshabilitado={ro} opciones={ALINEACIONES} onCambio={(v) => onCambio({ alineacion: v as AlineacionCorta })} />
            </CampoForm>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border p-2">
            <Label htmlFor={`${p}-neg`}>Negrita</Label>
            <Switch id={`${p}-neg`} checked={campo.negrita} disabled={ro} onCheckedChange={(v) => onCambio({ negrita: v })} />
          </div>
        </>
      )}

      {campo.tipo === "casilla" && (
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">Dibuja una «X» cuando…</legend>
          <CampoForm id={`${p}-var`} etiqueta="Dato" error={err("condicion.variable")}>
            <SelectorVariable
              aria-label="Dato de la condición"
              variables={entorno.escalares}
              valor={campo.condicion.variable || null}
              deshabilitado={ro}
              onElegir={(v) => onCambio({ condicion: { ...campo.condicion, variable: v ?? "" } })}
            />
          </CampoForm>
          <CampoForm id={`${p}-op`} etiqueta="Condición" error={err("condicion.operador")}>
            <SelectSimple id={`${p}-op`} valor={campo.condicion.operador} deshabilitado={ro} opciones={OPERADORES} onCambio={(v) => onCambio({ condicion: { ...campo.condicion, operador: v as OperadorCondicion } })} />
          </CampoForm>
          {(campo.condicion.operador === "igual" || campo.condicion.operador === "distinto") && (
            <CampoForm id={`${p}-val`} etiqueta="Valor" error={err("condicion.valor")} ayuda="Por ejemplo: CASADO, MASCULINO, SI.">
              <Input id={`${p}-val`} value={campo.condicion.valor} maxLength={120} disabled={ro} aria-invalid={Boolean(err("condicion.valor"))} onChange={(e) => onCambio({ condicion: { ...campo.condicion, valor: e.target.value } })} />
            </CampoForm>
          )}
        </fieldset>
      )}

      {campo.tipo === "foto" && <p className="text-sm text-muted-foreground">La foto del trabajador se ajusta al rectángulo.</p>}

      {campo.tipo === "tabla" && (
        <>
          <CampoForm id={`${p}-col`} etiqueta="Lista de datos" error={err("coleccion")}>
            <SelectSimple
              id={`${p}-col`}
              valor={campo.coleccion}
              deshabilitado={ro}
              placeholder="Elegir lista…"
              opciones={entorno.colecciones.map((c) => ({ valor: c.clave, etiqueta: c.etiqueta }))}
              onCambio={(v) =>
                onCambio({
                  coleccion: v,
                  columnas: columnasDeColeccion(entorno.catalogo, v)
                    .slice(0, 3)
                    .map((c, i) => ({ variable: c.clave, dx: i * 50, ancho: 50, alineacion: "izquierda" as const })),
                })
              }
            />
          </CampoForm>
          <div className="grid grid-cols-3 gap-2">
            <CampoForm id={`${p}-int`} etiqueta="Interlineado (mm)" error={err("interlineado")}>
              <InputNumero id={`${p}-int`} valor={campo.interlineado} paso={0.5} min={2} max={60} deshabilitado={ro} onCambio={(n) => onCambio({ interlineado: n })} />
            </CampoForm>
            <CampoForm id={`${p}-filas`} etiqueta="Filas máx." error={err("filas_max")}>
              <InputNumero id={`${p}-filas`} valor={campo.filas_max} min={1} max={60} deshabilitado={ro} onCambio={(n) => onCambio({ filas_max: Math.round(n) })} />
            </CampoForm>
            <CampoForm id={`${p}-tam`} etiqueta="Letra (pt)" error={err("tamano")}>
              <InputNumero id={`${p}-tam`} valor={campo.tamano} paso={0.5} min={5} max={28} deshabilitado={ro} onCambio={(n) => onCambio({ tamano: n })} />
            </CampoForm>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Columnas</span>
            {campo.columnas.map((c, j) => {
              const disponibles = columnasDeColeccion(entorno.catalogo, campo.coleccion);
              const poner = (parcial: Partial<typeof c>) => onCambio({ columnas: campo.columnas.map((x, k) => (k === j ? { ...x, ...parcial } : x)) });
              return (
                <fieldset key={j} className="grid gap-2 rounded-lg border p-3">
                  <legend className="px-1 text-xs text-muted-foreground">Columna {j + 1}</legend>
                  <CampoForm id={`${p}-c${j}-var`} etiqueta="Dato" error={err(`columnas.${j}.variable`)}>
                    <SelectSimple id={`${p}-c${j}-var`} valor={c.variable} deshabilitado={ro} opciones={disponibles.map((d) => ({ valor: d.clave, etiqueta: d.etiqueta }))} onCambio={(v) => poner({ variable: v })} />
                  </CampoForm>
                  <div className="grid grid-cols-3 gap-2">
                    <CampoForm id={`${p}-c${j}-dx`} etiqueta="Desde x (mm)" error={err(`columnas.${j}.dx`)}>
                      <InputNumero id={`${p}-c${j}-dx`} valor={c.dx} paso={0.5} min={0} deshabilitado={ro} onCambio={(n) => poner({ dx: n })} />
                    </CampoForm>
                    <CampoForm id={`${p}-c${j}-an`} etiqueta="Ancho (mm)" error={err(`columnas.${j}.ancho`)}>
                      <InputNumero id={`${p}-c${j}-an`} valor={c.ancho} paso={0.5} min={1} deshabilitado={ro} onCambio={(n) => poner({ ancho: n })} />
                    </CampoForm>
                    <CampoForm id={`${p}-c${j}-al`} etiqueta="Alineación">
                      <SelectSimple id={`${p}-c${j}-al`} valor={c.alineacion} deshabilitado={ro} opciones={ALINEACIONES} onCambio={(v) => poner({ alineacion: v as AlineacionCorta })} />
                    </CampoForm>
                  </div>
                  {!ro && campo.columnas.length > 1 && (
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => onCambio({ columnas: campo.columnas.filter((_, k) => k !== j) })}>
                        <Trash2 aria-hidden /> Quitar columna
                      </Button>
                    </div>
                  )}
                </fieldset>
              );
            })}
            {err("columnas") && <p role="alert" className="text-sm text-destructive">{err("columnas")}</p>}
            {!ro && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={campo.columnas.length >= LIMITES.MAX_COLUMNAS_TABLA || !campo.coleccion}
                onClick={() => {
                  const dispo = columnasDeColeccion(entorno.catalogo, campo.coleccion);
                  const usadas = new Set(campo.columnas.map((c) => c.variable));
                  const libre = dispo.find((c) => !usadas.has(c.clave)) ?? dispo[0];
                  const ultimo = campo.columnas[campo.columnas.length - 1];
                  if (libre) onCambio({ columnas: [...campo.columnas, { variable: libre.clave, dx: ultimo ? ultimo.dx + ultimo.ancho : 0, ancho: 40, alineacion: "izquierda" }] });
                }}
              >
                <Plus aria-hidden /> Agregar columna
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
