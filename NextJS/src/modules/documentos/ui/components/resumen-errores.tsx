"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DefinicionDocumento, ErrorValidacion, ModoPlantilla } from "../../domain/entities/plantilla";
import { ubicarError, type UbicacionError } from "../../domain/lib/errores";

interface Props {
  errores: ErrorValidacion[];
  modo: ModoPlantilla;
  definicion: DefinicionDocumento;
  onIr: (ubicacion: UbicacionError) => void;
  maximo?: number;
}

/** Lista corta de lo que falta corregir, con salto al bloque o campo afectado. */
export function ResumenErrores({ errores, modo, definicion, onIr, maximo = 4 }: Props) {
  if (errores.length === 0) return null;
  return (
    <div role="alert" className="grid gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="size-4" aria-hidden /> {errores.length === 1 ? "Hay 1 dato por corregir" : `Hay ${errores.length} datos por corregir`}
      </p>
      <ul className="grid gap-1">
        {errores.slice(0, maximo).map((e, i) => {
          const u = ubicarError(e.ruta, modo, definicion);
          const sePuedeIr = Boolean(u.bloqueId || u.campoId || u.campoPropioIdx !== undefined || u.ajustes || u.paginaIdx !== undefined);
          return (
            <li key={`${e.ruta}-${i}`} className="flex items-start justify-between gap-2">
              <span>{e.mensaje}</span>
              {sePuedeIr && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onIr(u)}>
                  Ir
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {errores.length > maximo && <p className="text-xs text-muted-foreground">y {errores.length - maximo} más…</p>}
    </div>
  );
}
