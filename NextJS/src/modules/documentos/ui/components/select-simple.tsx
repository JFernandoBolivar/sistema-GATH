"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface OpcionSelect {
  valor: string;
  etiqueta: string;
}

interface Props {
  valor: string;
  onCambio: (valor: string) => void;
  opciones: OpcionSelect[];
  deshabilitado?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/** Envoltorio mínimo de Select para listas de opciones simples. */
export function SelectSimple({ valor, onCambio, opciones, deshabilitado, placeholder, id, className, ...resto }: Props) {
  return (
    <Select value={valor} onValueChange={onCambio} disabled={deshabilitado}>
      <SelectTrigger id={id} className={className ?? "w-full"} aria-label={resto["aria-label"]}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
