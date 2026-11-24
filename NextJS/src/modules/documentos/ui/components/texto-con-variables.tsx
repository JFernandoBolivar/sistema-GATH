"use client";

import { useRef } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { insertarVariableEnTexto, variablesDesconocidas } from "../../domain/lib/variables";
import type { EntornoEditor } from "../lib/entorno";
import { SelectorVariable } from "./selector-variable";

interface Props {
  id?: string;
  valor: string;
  onCambio: (v: string) => void;
  entorno: EntornoEditor;
  multilinea?: boolean;
  filas?: number;
  maximo?: number;
  error?: string;
  "aria-label"?: string;
}

/** Texto con `{variables}`: el selector inserta la variable en la posición del cursor y avisa de las desconocidas. */
export function TextoConVariables({ id, valor, onCambio, entorno, multilinea = true, filas = 4, maximo = 4000, error, ...resto }: Props) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const desconocidas = variablesDesconocidas(valor, entorno.ctx);

  const insertar = (clave: string | null) => {
    if (!clave) return;
    const el = ref.current;
    const r = insertarVariableEnTexto(valor, clave, el?.selectionStart, el?.selectionEnd);
    onCambio(r.texto);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(r.cursor, r.cursor);
    });
  };

  return (
    <div className="grid gap-1.5">
      {multilinea ? (
        <Textarea
          id={id}
          ref={ref}
          rows={filas}
          value={valor}
          maxLength={maximo}
          disabled={entorno.soloLectura}
          aria-invalid={Boolean(error)}
          aria-label={resto["aria-label"]}
          onChange={(e) => onCambio(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          ref={ref}
          value={valor}
          maxLength={maximo}
          disabled={entorno.soloLectura}
          aria-invalid={Boolean(error)}
          aria-label={resto["aria-label"]}
          onChange={(e) => onCambio(e.target.value)}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <SelectorVariable
          modo="insertar"
          variables={entorno.escalares}
          onElegir={insertar}
          deshabilitado={entorno.soloLectura}
        />
        <span className="text-xs text-muted-foreground">Use {"{variable}"} para insertar datos.</span>
      </div>
      {desconocidas.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          Variable desconocida: {desconocidas.map((v) => `{${v}}`).join(", ")}
        </p>
      )}
      {error && desconocidas.length === 0 && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
