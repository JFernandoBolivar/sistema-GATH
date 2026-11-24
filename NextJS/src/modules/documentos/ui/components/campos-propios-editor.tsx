"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CampoPropio, TipoCampoPropio } from "../../domain/entities/plantilla";
import { claveDesdeEtiqueta, nuevoCampoPropio } from "../../domain/lib/factorias";
import { LIMITES } from "../../domain/lib/esquemas";
import { ETIQUETA_TIPO_CAMPO_PROPIO } from "../lib/etiquetas";
import type { EntornoEditor } from "../lib/entorno";
import { SelectSimple } from "./select-simple";

interface Props {
  campos: CampoPropio[];
  onCambio: (fn: (c: CampoPropio[]) => CampoPropio[]) => void;
  entorno: EntornoEditor;
}

/** Lista editable de «Campos propios del documento»: datos que el catálogo no trae y que se usan como `{propio.clave}`. */
export function CamposPropiosEditor({ campos, onCambio, entorno }: Props) {
  const ro = entorno.soloLectura;
  const poner = (i: number, parcial: Partial<CampoPropio>) =>
    onCambio((l) => l.map((c, j) => (j === i ? { ...c, ...parcial } : c)));

  return (
    <section aria-labelledby="titulo-campos-propios" className="grid gap-3">
      <div>
        <h3 id="titulo-campos-propios" className="font-semibold">Campos propios del documento</h3>
        <p className="text-sm text-muted-foreground">
          Datos propios de este documento (por ejemplo «Fecha de ingreso estimada»). Se usan como variables{" "}
          <span className="font-mono">{"{propio.clave}"}</span>; por ahora se ven con datos de ejemplo en la vista previa.
        </p>
      </div>

      {campos.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Este documento no tiene campos propios.</p>
      )}

      {campos.map((c, i) => {
        const ruta = `campos_propios.${i}`;
        return (
          <fieldset key={i} className="grid gap-3 rounded-lg border bg-background p-3">
            <legend className="px-1 font-mono text-xs text-muted-foreground">{`{propio.${c.clave}}`}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={`cp-etq-${i}`}>Etiqueta</Label>
                <Input
                  id={`cp-etq-${i}`}
                  value={c.etiqueta}
                  disabled={ro}
                  maxLength={300}
                  aria-invalid={Boolean(entorno.errores[`${ruta}.etiqueta`])}
                  onChange={(e) => poner(i, { etiqueta: e.target.value })}
                  onBlur={() => {
                    // La clave sigue a la etiqueta mientras conserve el valor de arranque «campo_N».
                    if (/^campo_\d+$/.test(c.clave) && c.etiqueta.trim()) {
                      const clave = claveDesdeEtiqueta(c.etiqueta);
                      if (!campos.some((o, j) => j !== i && o.clave === clave)) poner(i, { clave });
                    }
                  }}
                />
                {entorno.errores[`${ruta}.etiqueta`] && <p className="text-sm text-destructive">{entorno.errores[`${ruta}.etiqueta`]}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`cp-clave-${i}`}>Clave</Label>
                <Input
                  id={`cp-clave-${i}`}
                  className="font-mono"
                  value={c.clave}
                  disabled={ro}
                  maxLength={40}
                  aria-invalid={Boolean(entorno.errores[`${ruta}.clave`])}
                  onChange={(e) => poner(i, { clave: e.target.value })}
                />
                {entorno.errores[`${ruta}.clave`] && <p className="text-sm text-destructive">{entorno.errores[`${ruta}.clave`]}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <SelectSimple
                  valor={c.tipo}
                  deshabilitado={ro}
                  onCambio={(v) => {
                    const tipo = v as TipoCampoPropio;
                    poner(i, { tipo, opciones: tipo === "opcion" ? (c.opciones?.length ? c.opciones : ["Opción 1"]) : undefined });
                  }}
                  opciones={Object.entries(ETIQUETA_TIPO_CAMPO_PROPIO).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-2 sm:mt-6">
                <Label htmlFor={`cp-obl-${i}`}>Obligatorio</Label>
                <Switch id={`cp-obl-${i}`} checked={c.obligatorio} disabled={ro} onCheckedChange={(v) => poner(i, { obligatorio: v })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`cp-ayuda-${i}`}>Ayuda para quien lo completa</Label>
              <Input id={`cp-ayuda-${i}`} value={c.ayuda} disabled={ro} maxLength={240} onChange={(e) => poner(i, { ayuda: e.target.value })} />
            </div>
            {c.tipo === "opcion" && (
              <div className="grid gap-1.5">
                <Label htmlFor={`cp-opc-${i}`}>Opciones (una por línea)</Label>
                <Textarea
                  id={`cp-opc-${i}`}
                  rows={3}
                  disabled={ro}
                  value={(c.opciones ?? []).join("\n")}
                  aria-invalid={Boolean(entorno.errores[`${ruta}.opciones`])}
                  onChange={(e) => poner(i, { opciones: e.target.value.split("\n").slice(0, 30) })}
                />
                {entorno.errores[`${ruta}.opciones`] && <p className="text-sm text-destructive">{entorno.errores[`${ruta}.opciones`]}</p>}
              </div>
            )}
            {!ro && (
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => onCambio((l) => l.filter((_, j) => j !== i))}>
                  <Trash2 aria-hidden /> Quitar campo
                </Button>
              </div>
            )}
          </fieldset>
        );
      })}

      {!ro && (
        <Button
          type="button"
          variant="outline"
          disabled={campos.length >= LIMITES.MAX_CAMPOS_PROPIOS}
          onClick={() => onCambio((l) => [...l, nuevoCampoPropio(l)])}
        >
          <Plus aria-hidden /> Agregar campo propio
        </Button>
      )}
    </section>
  );
}
