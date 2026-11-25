"use client";

import { useMemo } from "react";
import { Lock } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProcesoPlantilla } from "../../domain/entities/plantilla";
import { agruparProcesos } from "../../domain/lib/procesos";
import { tituloGrupoProceso } from "../lib/etiquetas";

interface Props {
  id: string;
  procesos: readonly ProcesoPlantilla[];
  valor: string;
  onCambio: (codigo: string) => void;
  /** Sin permiso de edición o catálogo todavía cargando. */
  deshabilitado?: boolean;
  /** Una plantilla publicada no puede cambiar de proceso. */
  bloqueado?: boolean;
  error?: string;
}

/** «¿En qué proceso se usa?»: opciones agrupadas por área, cada una con su descripción. */
export function SelectorProceso({ id, procesos, valor, onCambio, deshabilitado, bloqueado, error }: Props) {
  const grupos = useMemo(() => agruparProcesos(procesos), [procesos]);
  const actual = procesos.find((p) => p.codigo === valor);
  const idAyuda = `${id}-ayuda`;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>¿En qué proceso se usa?</Label>
      <Select value={valor} onValueChange={onCambio} disabled={deshabilitado || bloqueado}>
        <SelectTrigger
          id={id}
          className="h-auto min-h-11 w-full py-2 data-[size=default]:h-auto"
          aria-invalid={Boolean(error)}
          aria-describedby={idAyuda}
        >
          <SelectValue placeholder="Seleccione un proceso">
            {actual && (
              <span className="flex min-w-0 flex-col items-start text-left">
                <span className="whitespace-normal">{actual.etiqueta}</span>
                <span className="text-xs font-normal text-muted-foreground">{tituloGrupoProceso(actual.grupo)}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[min(70dvh,28rem)] max-w-[calc(100vw-2rem)]">
          {grupos.map((g) => (
            <SelectGroup key={g.grupo}>
              <SelectLabel className="font-semibold uppercase tracking-wide">{tituloGrupoProceso(g.grupo)}</SelectLabel>
              {g.procesos.map((p) => (
                <SelectItem key={p.codigo} value={p.codigo} className="items-start py-2">
                  <span className="flex min-w-0 flex-col gap-0.5 whitespace-normal">
                    <span className="font-medium">{p.etiqueta}</span>
                    {p.descripcion && <span className="text-xs text-muted-foreground">{p.descripcion}</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p id={idAyuda} className="flex items-start gap-1.5 text-xs text-muted-foreground">
        {bloqueado ? (
          <>
            <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span>
              El proceso queda fijo al publicar la plantilla. Para usarla en otro proceso, duplíquela como borrador.
            </span>
          </>
        ) : (
          <span>
            {actual?.descripcion ?? "Define qué datos puede usar la plantilla."} Solo se ofrecen las variables de este
            proceso; después de publicar ya no podrá cambiarse.
          </span>
        )}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
