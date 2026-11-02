"use client";

/**
 * Controles de selección de catálogo compartidos para formularios del módulo
 * de personal. Extraídos a un archivo propio para no duplicarlos entre vistas.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogoEmpleadoDTO } from "../application/dtos/empleado-dto";

export function CatalogSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string | undefined;
  onChange: (v: number) => void;
  options: CatalogoEmpleadoDTO[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ? Number(v) : 0)}>
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

export function MultiCatalogCheckbox({
  value,
  onChange,
  options,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  options: CatalogoEmpleadoDTO[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const activo = value.includes(o.id);
        return (
          <label key={o.id} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <input
              type="checkbox"
              className="size-3.5"
              checked={activo}
              onChange={() => onChange(activo ? value.filter((x) => x !== o.id) : [...value, o.id])}
            />
            {o.nombre}
          </label>
        );
      })}
    </div>
  );
}
