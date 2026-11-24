"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AlineacionCorta,
  AlineacionTexto,
  Bloque,
  CeldaFila,
} from "../../domain/entities/plantilla";
import { LIMITES } from "../../domain/lib/esquemas";
import { ETIQUETAS_BLOQUE } from "../../domain/lib/factorias";
import { columnasDeColeccion, opcionesSugeridas } from "../../domain/lib/variables";
import type { EntornoEditor } from "../lib/entorno";
import { ETIQUETA_ALINEACION } from "../lib/etiquetas";
import { CampoForm } from "./campo-form";
import { InputNumero } from "./input-numero";
import { SelectorVariable } from "./selector-variable";
import { SelectSimple } from "./select-simple";
import { TextoConVariables } from "./texto-con-variables";

interface Props {
  bloque: Bloque;
  /** Índice en la lista (para las rutas de error `bloques.<i>...`). */
  indice: number;
  entorno: EntornoEditor;
  onCambio: (cambios: Partial<Bloque>) => void;
}

const OPCIONES_ALINEACION_TEXTO = (Object.keys(ETIQUETA_ALINEACION) as AlineacionTexto[]).map((v) => ({
  valor: v,
  etiqueta: ETIQUETA_ALINEACION[v],
}));
const OPCIONES_ALINEACION_CORTA = (["izquierda", "centro", "derecha"] as AlineacionCorta[]).map((v) => ({
  valor: v,
  etiqueta: ETIQUETA_ALINEACION[v],
}));

/** Formulario de propiedades específico del tipo de bloque seleccionado. */
export function PropiedadesBloque({ bloque, indice, entorno, onCambio }: Props) {
  const ro = entorno.soloLectura;
  const ruta = `bloques.${indice}`;
  const err = (sub: string) => entorno.errores[`${ruta}.${sub}`];
  const p = `pb-${bloque.id}`;

  return (
    <div className="grid gap-4" data-testid="propiedades-bloque">
      <h3 className="font-semibold">{ETIQUETAS_BLOQUE[bloque.tipo]}</h3>

      {bloque.tipo === "seccion" && (
        <CampoForm id={`${p}-titulo`} etiqueta="Título de la sección" error={err("titulo")}>
          <Input id={`${p}-titulo`} value={bloque.titulo} maxLength={300} disabled={ro} aria-invalid={Boolean(err("titulo"))} onChange={(e) => onCambio({ titulo: e.target.value })} />
        </CampoForm>
      )}

      {bloque.tipo === "fila_campos" && (
        <>
          <div className="grid gap-3">
            {bloque.celdas.map((c, j) => {
              const poner = (parcial: Partial<CeldaFila>) =>
                onCambio({ celdas: bloque.celdas.map((x, k) => (k === j ? { ...x, ...parcial } : x)) });
              return (
                <fieldset key={j} className="grid gap-2 rounded-lg border p-3">
                  <legend className="px-1 text-xs text-muted-foreground">Celda {j + 1}</legend>
                  <CampoForm id={`${p}-c${j}-etq`} etiqueta="Etiqueta" error={err(`celdas.${j}.etiqueta`)}>
                    <Input id={`${p}-c${j}-etq`} value={c.etiqueta} maxLength={300} disabled={ro} onChange={(e) => poner({ etiqueta: e.target.value })} />
                  </CampoForm>
                  <CampoForm id={`${p}-c${j}-var`} etiqueta="Dato que muestra" error={err(`celdas.${j}.variable`)}>
                    <SelectorVariable
                      aria-label={`Dato de la celda ${j + 1}`}
                      variables={entorno.escalares}
                      valor={c.variable}
                      permitirVacio
                      deshabilitado={ro}
                      onElegir={(v) => poner({ variable: v })}
                    />
                  </CampoForm>
                  <CampoForm id={`${p}-c${j}-ancho`} etiqueta="Ancho relativo (1 a 12)" error={err(`celdas.${j}.ancho`)} ayuda="Una celda de 6 junto a otra de 6 se reparten la fila por mitades.">
                    <InputNumero id={`${p}-c${j}-ancho`} valor={c.ancho} min={1} max={12} deshabilitado={ro} invalido={Boolean(err(`celdas.${j}.ancho`))} onCambio={(n) => poner({ ancho: n })} />
                  </CampoForm>
                  {!ro && bloque.celdas.length > 1 && (
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => onCambio({ celdas: bloque.celdas.filter((_, k) => k !== j) })}>
                        <Trash2 aria-hidden /> Quitar celda
                      </Button>
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
          {err("celdas") && <p role="alert" className="text-sm text-destructive">{err("celdas")}</p>}
          {!ro && (
            <Button
              type="button"
              variant="outline"
              disabled={bloque.celdas.length >= LIMITES.MAX_CELDAS}
              onClick={() => onCambio({ celdas: [...bloque.celdas, { etiqueta: "Campo", variable: null, ancho: 6 }] })}
            >
              <Plus aria-hidden /> Agregar celda
            </Button>
          )}
          <CampoForm id={`${p}-alto`} etiqueta="Alto mínimo de la fila (mm)" error={err("alto_mm")} ayuda="De 8 a 120 mm. Deje espacio si se completa a mano.">
            <InputNumero id={`${p}-alto`} valor={bloque.alto_mm} min={8} max={120} deshabilitado={ro} invalido={Boolean(err("alto_mm"))} onCambio={(n) => onCambio({ alto_mm: n })} />
          </CampoForm>
        </>
      )}

      {bloque.tipo === "casillas" && (
        <>
          <CampoForm id={`${p}-etq`} etiqueta="Pregunta o título" error={err("etiqueta")}>
            <Input id={`${p}-etq`} value={bloque.etiqueta} maxLength={300} disabled={ro} onChange={(e) => onCambio({ etiqueta: e.target.value })} />
          </CampoForm>
          <CampoForm id={`${p}-var`} etiqueta="Dato que decide la casilla marcada" error={err("variable")} ayuda="Se marca la opción cuyo valor coincide con el dato.">
            <SelectorVariable
              aria-label="Dato de las casillas"
              variables={entorno.escalares}
              valor={bloque.variable || null}
              deshabilitado={ro}
              onElegir={(v) => onCambio({ variable: v ?? "" })}
            />
          </CampoForm>
          <CampoForm id={`${p}-cols`} etiqueta="Columnas (1 a 6)" error={err("columnas")}>
            <InputNumero id={`${p}-cols`} valor={bloque.columnas} min={1} max={6} deshabilitado={ro} onCambio={(n) => onCambio({ columnas: Math.round(n) })} />
          </CampoForm>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Opciones</span>
              {!ro && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={opcionesSugeridas(bloque.variable, entorno.catalogo, entorno.propios).length === 0}
                  title="Genera las opciones a partir de los valores habituales del dato elegido"
                  onClick={() => onCambio({ opciones: opcionesSugeridas(bloque.variable, entorno.catalogo, entorno.propios) })}
                >
                  <Sparkles aria-hidden /> Generar desde el dato
                </Button>
              )}
            </div>
            {bloque.opciones.map((o, j) => (
              <div key={j} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                <div>
                  <Input
                    aria-label={`Valor de la opción ${j + 1}`}
                    placeholder="Valor (p. ej. CASADO)"
                    value={o.valor}
                    maxLength={80}
                    disabled={ro}
                    aria-invalid={Boolean(err(`opciones.${j}.valor`))}
                    onChange={(e) => onCambio({ opciones: bloque.opciones.map((x, k) => (k === j ? { ...x, valor: e.target.value } : x)) })}
                  />
                  {err(`opciones.${j}.valor`) && <p className="text-xs text-destructive">{err(`opciones.${j}.valor`)}</p>}
                </div>
                <div>
                  <Input
                    aria-label={`Texto de la opción ${j + 1}`}
                    placeholder="Texto visible"
                    value={o.etiqueta}
                    maxLength={80}
                    disabled={ro}
                    aria-invalid={Boolean(err(`opciones.${j}.etiqueta`))}
                    onChange={(e) => onCambio({ opciones: bloque.opciones.map((x, k) => (k === j ? { ...x, etiqueta: e.target.value } : x)) })}
                  />
                  {err(`opciones.${j}.etiqueta`) && <p className="text-xs text-destructive">{err(`opciones.${j}.etiqueta`)}</p>}
                </div>
                {!ro && (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar la opción ${j + 1}`} onClick={() => onCambio({ opciones: bloque.opciones.filter((_, k) => k !== j) })}>
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </div>
            ))}
            {err("opciones") && <p role="alert" className="text-sm text-destructive">{err("opciones")}</p>}
            {!ro && (
              <Button type="button" variant="outline" size="sm" disabled={bloque.opciones.length >= LIMITES.MAX_OPCIONES} onClick={() => onCambio({ opciones: [...bloque.opciones, { valor: "", etiqueta: "" }] })}>
                <Plus aria-hidden /> Agregar opción
              </Button>
            )}
          </div>
        </>
      )}

      {bloque.tipo === "tabla" && (
        <>
          <CampoForm id={`${p}-titulo`} etiqueta="Título de la tabla" error={err("titulo")}>
            <Input id={`${p}-titulo`} value={bloque.titulo} maxLength={300} disabled={ro} onChange={(e) => onCambio({ titulo: e.target.value })} />
          </CampoForm>
          <CampoForm id={`${p}-coleccion`} etiqueta="Lista de datos" error={err("coleccion")} ayuda="Al cambiarla se reinician las columnas.">
            <SelectSimple
              id={`${p}-coleccion`}
              valor={bloque.coleccion}
              deshabilitado={ro}
              placeholder="Elegir lista…"
              onCambio={(v) => {
                const cols = columnasDeColeccion(entorno.catalogo, v).slice(0, 3);
                const col = entorno.colecciones.find((c) => c.clave === v);
                onCambio({
                  coleccion: v,
                  titulo: bloque.titulo || col?.etiqueta || "",
                  columnas: cols.map((c) => ({ variable: c.clave, etiqueta: c.etiqueta, ancho: 4 })),
                });
              }}
              opciones={entorno.colecciones.map((c) => ({ valor: c.clave, etiqueta: c.etiqueta }))}
            />
          </CampoForm>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Columnas</span>
            {bloque.columnas.map((c, j) => {
              const disponibles = columnasDeColeccion(entorno.catalogo, bloque.coleccion);
              const poner = (parcial: Partial<typeof c>) =>
                onCambio({ columnas: bloque.columnas.map((x, k) => (k === j ? { ...x, ...parcial } : x)) });
              return (
                <fieldset key={j} className="grid gap-2 rounded-lg border p-3">
                  <legend className="px-1 text-xs text-muted-foreground">Columna {j + 1}</legend>
                  <CampoForm id={`${p}-col${j}-var`} etiqueta="Dato" error={err(`columnas.${j}.variable`)}>
                    <SelectSimple
                      id={`${p}-col${j}-var`}
                      valor={c.variable}
                      deshabilitado={ro}
                      onCambio={(v) => poner({ variable: v, etiqueta: disponibles.find((d) => d.clave === v)?.etiqueta ?? c.etiqueta })}
                      opciones={disponibles.map((d) => ({ valor: d.clave, etiqueta: d.etiqueta }))}
                    />
                  </CampoForm>
                  <div className="grid grid-cols-2 gap-2">
                    <CampoForm id={`${p}-col${j}-etq`} etiqueta="Encabezado" error={err(`columnas.${j}.etiqueta`)}>
                      <Input id={`${p}-col${j}-etq`} value={c.etiqueta} maxLength={60} disabled={ro} onChange={(e) => poner({ etiqueta: e.target.value })} />
                    </CampoForm>
                    <CampoForm id={`${p}-col${j}-ancho`} etiqueta="Ancho (1 a 12)" error={err(`columnas.${j}.ancho`)}>
                      <InputNumero id={`${p}-col${j}-ancho`} valor={c.ancho} min={1} max={12} deshabilitado={ro} onCambio={(n) => poner({ ancho: n })} />
                    </CampoForm>
                  </div>
                  {!ro && bloque.columnas.length > 1 && (
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => onCambio({ columnas: bloque.columnas.filter((_, k) => k !== j) })}>
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
                disabled={bloque.columnas.length >= LIMITES.MAX_COLUMNAS_TABLA || !bloque.coleccion}
                onClick={() => {
                  const usadas = new Set(bloque.columnas.map((c) => c.variable));
                  const libre = columnasDeColeccion(entorno.catalogo, bloque.coleccion).find((c) => !usadas.has(c.clave)) ?? columnasDeColeccion(entorno.catalogo, bloque.coleccion)[0];
                  if (libre) onCambio({ columnas: [...bloque.columnas, { variable: libre.clave, etiqueta: libre.etiqueta, ancho: 4 }] });
                }}
              >
                <Plus aria-hidden /> Agregar columna
              </Button>
            )}
          </div>
          <CampoForm id={`${p}-filas`} etiqueta="Filas mínimas (0 a 40)" error={err("filas_minimas")} ayuda="Filas en blanco que se imprimen aunque haya menos datos.">
            <InputNumero id={`${p}-filas`} valor={bloque.filas_minimas} min={0} max={40} deshabilitado={ro} onCambio={(n) => onCambio({ filas_minimas: Math.round(n) })} />
          </CampoForm>
        </>
      )}

      {bloque.tipo === "parrafo" && (
        <>
          <CampoForm id={`${p}-texto`} etiqueta="Texto del párrafo" error={err("texto")}>
            <TextoConVariables id={`${p}-texto`} valor={bloque.texto} entorno={entorno} onCambio={(t) => onCambio({ texto: t })} error={err("texto")} filas={6} />
          </CampoForm>
          <CampoForm id={`${p}-alin`} etiqueta="Alineación" error={err("alineacion")}>
            <SelectSimple id={`${p}-alin`} valor={bloque.alineacion} deshabilitado={ro} onCambio={(v) => onCambio({ alineacion: v as AlineacionTexto })} opciones={OPCIONES_ALINEACION_TEXTO} />
          </CampoForm>
        </>
      )}

      {bloque.tipo === "foto" && (
        <>
          <CampoForm id={`${p}-alin`} etiqueta="Alineación" error={err("alineacion")}>
            <SelectSimple id={`${p}-alin`} valor={bloque.alineacion} deshabilitado={ro} onCambio={(v) => onCambio({ alineacion: v as AlineacionCorta })} opciones={OPCIONES_ALINEACION_CORTA} />
          </CampoForm>
          <div className="grid grid-cols-2 gap-2">
            <CampoForm id={`${p}-ancho`} etiqueta="Ancho (15 a 80 mm)" error={err("ancho_mm")}>
              <InputNumero id={`${p}-ancho`} valor={bloque.ancho_mm} min={15} max={80} deshabilitado={ro} onCambio={(n) => onCambio({ ancho_mm: n })} />
            </CampoForm>
            <CampoForm id={`${p}-alto`} etiqueta="Alto (15 a 100 mm)" error={err("alto_mm")}>
              <InputNumero id={`${p}-alto`} valor={bloque.alto_mm} min={15} max={100} deshabilitado={ro} onCambio={(n) => onCambio({ alto_mm: n })} />
            </CampoForm>
          </div>
        </>
      )}

      {bloque.tipo === "firmas" && (
        <div className="grid gap-3">
          {bloque.firmantes.map((f, j) => (
            <fieldset key={j} className="grid gap-2 rounded-lg border p-3">
              <legend className="px-1 text-xs text-muted-foreground">Firmante {j + 1}</legend>
              <CampoForm id={`${p}-f${j}-etq`} etiqueta="Etiqueta" error={err(`firmantes.${j}.etiqueta`)}>
                <Input id={`${p}-f${j}-etq`} value={f.etiqueta} maxLength={80} disabled={ro} onChange={(e) => onCambio({ firmantes: bloque.firmantes.map((x, k) => (k === j ? { ...x, etiqueta: e.target.value } : x)) })} />
              </CampoForm>
              <CampoForm id={`${p}-f${j}-det`} etiqueta="Detalle (cargo, nombre…)" error={err(`firmantes.${j}.detalle`)}>
                <Input id={`${p}-f${j}-det`} value={f.detalle} maxLength={120} disabled={ro} onChange={(e) => onCambio({ firmantes: bloque.firmantes.map((x, k) => (k === j ? { ...x, detalle: e.target.value } : x)) })} />
              </CampoForm>
              {!ro && bloque.firmantes.length > 1 && (
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => onCambio({ firmantes: bloque.firmantes.filter((_, k) => k !== j) })}>
                    <Trash2 aria-hidden /> Quitar firmante
                  </Button>
                </div>
              )}
            </fieldset>
          ))}
          {err("firmantes") && <p role="alert" className="text-sm text-destructive">{err("firmantes")}</p>}
          {!ro && (
            <Button type="button" variant="outline" size="sm" disabled={bloque.firmantes.length >= LIMITES.MAX_FIRMANTES} onClick={() => onCambio({ firmantes: [...bloque.firmantes, { etiqueta: "Firma", detalle: "" }] })}>
              <Plus aria-hidden /> Agregar firmante
            </Button>
          )}
        </div>
      )}

      {bloque.tipo === "salto_pagina" && (
        <p className="text-sm text-muted-foreground">Lo que sigue a este bloque se imprime en una página nueva. No tiene propiedades.</p>
      )}
    </div>
  );
}
