"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MAX_TEXTO_CAMPO_PROPIO, type CampoPropioDTO } from "../../domain/lib/documentos-expediente";

interface Props {
  /** Prefijo único para los `id` (varios documentos pueden convivir en la misma pantalla). */
  idBase: string;
  campos: readonly CampoPropioDTO[];
  /** `{clave: valor del control}`: las fechas como AAAA-MM-DD. */
  controles: Record<string, string>;
  onCambio: (clave: string, valor: string) => void;
  /** Errores por clave (del servidor o de la validación local). */
  errores?: Record<string, string>;
  deshabilitado?: boolean;
}

const SI_NO: ReadonlyArray<readonly [string, string]> = [
  ["SI", "Sí"],
  ["NO", "No"],
];

/** Formulario dinámico de los campos propios de un documento: texto, texto largo, fecha, sí/no y lista de opciones. */
export function CamposPropiosFormulario({ idBase, campos, controles, onCambio, errores = {}, deshabilitado }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {campos.map((c) => {
        const id = `${idBase}-${c.clave}`;
        const valor = controles[c.clave] ?? "";
        const error = errores[c.clave];
        const descripcion = [c.ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
        const ancho = c.tipo === "texto_largo" ? "sm:col-span-2" : "";
        return (
          <div key={c.clave} className={`flex min-w-0 flex-col gap-1.5 ${ancho}`} data-campo={c.clave}>
            <Label htmlFor={c.tipo === "si_no" ? undefined : id} id={`${id}-etiqueta`}>
              {c.etiqueta}
              {c.obligatorio && (
                <span className="text-destructive" aria-hidden>
                  {" "}
                  *
                </span>
              )}
              {c.obligatorio && <span className="sr-only"> (obligatorio)</span>}
            </Label>
            {c.tipo === "texto" && (
              <Input id={id} value={valor} disabled={deshabilitado} maxLength={MAX_TEXTO_CAMPO_PROPIO} aria-invalid={!!error} aria-describedby={descripcion} className="h-11 text-base" onChange={(e) => onCambio(c.clave, e.target.value)} />
            )}
            {c.tipo === "texto_largo" && (
              <Textarea id={id} value={valor} disabled={deshabilitado} rows={4} maxLength={MAX_TEXTO_CAMPO_PROPIO} aria-invalid={!!error} aria-describedby={descripcion} className="text-base" onChange={(e) => onCambio(c.clave, e.target.value)} />
            )}
            {c.tipo === "fecha" && (
              <Input id={id} type="date" value={valor} disabled={deshabilitado} aria-invalid={!!error} aria-describedby={descripcion} className="h-11 text-base" onChange={(e) => onCambio(c.clave, e.target.value)} />
            )}
            {c.tipo === "si_no" && (
              <RadioGroup value={valor} disabled={deshabilitado} onValueChange={(v) => onCambio(c.clave, v)} aria-labelledby={`${id}-etiqueta`} aria-describedby={descripcion} className="grid grid-cols-2 gap-3">
                {SI_NO.map(([v, texto]) => (
                  <div key={v} className="relative flex min-h-11 items-center gap-2 rounded-md border px-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <RadioGroupItem id={`${id}-${v}`} value={v} className="relative z-10" />
                    <Label htmlFor={`${id}-${v}`} className="flex-1 cursor-pointer py-3 text-base font-normal after:absolute after:inset-0">
                      {texto}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
            {c.tipo === "opcion" && (
              <Select value={valor} disabled={deshabilitado} onValueChange={(v) => onCambio(c.clave, v)}>
                <SelectTrigger id={id} className="h-11 w-full text-base" aria-invalid={!!error} aria-describedby={descripcion}>
                  <SelectValue placeholder="Elige una opción" />
                </SelectTrigger>
                <SelectContent>
                  {c.opciones.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {c.ayuda && (
              <p id={`${id}-ayuda`} className="text-sm text-muted-foreground">
                {c.ayuda}
              </p>
            )}
            {error && (
              <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
