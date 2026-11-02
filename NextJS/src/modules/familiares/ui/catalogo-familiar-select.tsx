"use client";

/**
 * Select de catálogo (parentesco/sexo) para el formulario de familiar.
 * Componente propio del módulo (no se cruza con `modules/personal`) para
 * respetar el aislamiento entre módulos de la arquitectura Feature-Based.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogoFamiliarDTO } from "../application/dtos/familiar-dto";

export function CatalogoFamiliarSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  options: CatalogoFamiliarDTO[];
  placeholder: string;
}) {
  return (
    <Select
      value={value ? String(value) : undefined}
      onValueChange={(v) => onChange(v ? Number(v) : 0)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
