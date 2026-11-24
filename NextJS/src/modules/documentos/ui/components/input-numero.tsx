"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";

interface Props {
  id?: string;
  valor: number;
  onCambio: (n: number) => void;
  min?: number;
  max?: number;
  paso?: number;
  deshabilitado?: boolean;
  invalido?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Número editable: permite borrar y escribir sin que el valor salte; solo confirma
 * valores numéricos válidos y, al salir, deja el texto con el valor vigente.
 */
export function InputNumero({ id, valor, onCambio, min, max, paso = 1, deshabilitado, invalido, className, ...resto }: Props) {
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      className={className}
      min={min}
      max={max}
      step={paso}
      disabled={deshabilitado}
      aria-invalid={invalido}
      aria-label={resto["aria-label"]}
      value={texto ?? String(Number.isFinite(valor) ? Math.round(valor * 100) / 100 : "")}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n)) onCambio(n);
      }}
      onBlur={() => setTexto(null)}
    />
  );
}
