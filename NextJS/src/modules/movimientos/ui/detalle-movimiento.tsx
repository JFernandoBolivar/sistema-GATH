"use client";

/**
 * Vista de detalle (solo lectura) de un movimiento de cargo. Réplica
 * parcial de paridad con el legado (`tableMoves/detail-info.tsx`) — con una
 * diferencia deliberada: el legado mostraba una comparación "Anterior /
 * Nuevo" por campo (denominación, específica, grado, dependencia, tipo de
 * nómina, estatus), porque el `EmployeeCargoHistory` legado traía
 * `prev_*`/`new_*` de cada movimiento. `MovimientoCargoDTO`
 * (`application/dtos/movimientos-dto.ts`) no tiene esos pares — cada fila
 * del historial nuevo es una fotografía del estado resultante del
 * movimiento, no un diff — así que aquí se muestra el estado resultante
 * completo en vez de fabricar una comparación con datos que no existen.
 * Controlado externamente (mismo patrón que `DetalleFamiliar`/
 * `EmpleadoDetalleSheet`) para que el menú de acciones de
 * `movimientos-columns.tsx` lo abra.
 */
import { Briefcase, Building2, FileText } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/components/sheet";

import type { MovimientoCargoDTO } from "../application/dtos/movimientos-dto";

const SIN_DATO = "N/A";

function FilaInfo({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1 text-sm">
      <div className="text-muted-foreground">{etiqueta}</div>
      <div>{valor ?? SIN_DATO}</div>
    </div>
  );
}

interface DetalleMovimientoProps {
  movimiento: MovimientoCargoDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetalleMovimiento({ movimiento, open, onOpenChange }: DetalleMovimientoProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Detalle del movimiento de cargo</SheetTitle>
        </SheetHeader>

        {movimiento && (
          <div className="flex flex-col gap-4 px-4 pb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileText className="size-4" aria-hidden="true" />
                  Información general
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FilaInfo etiqueta="Código de puesto" valor={movimiento.codigoPuesto} />
                <FilaInfo etiqueta="Cédula del empleado" valor={movimiento.empleadoCedula} />
                <FilaInfo etiqueta="Fecha del movimiento" valor={movimiento.fechaMovimiento} />
                <div className="grid grid-cols-2 gap-2 py-1 text-sm">
                  <div className="text-muted-foreground">Tipo de movimiento</div>
                  <div><Badge variant="secondary">{movimiento.tipoMovimiento}</Badge></div>
                </div>
                <FilaInfo etiqueta="Motivo" valor={movimiento.motivoNombre} />
                <FilaInfo etiqueta="Ejecutado por" valor={movimiento.ejecutadoPorNombre} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Briefcase className="size-4" aria-hidden="true" />
                  Cargo resultante
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FilaInfo etiqueta="Denominación" valor={movimiento.denominacionNombre} />
                <FilaInfo etiqueta="Cargo específico" valor={movimiento.especificaNombre} />
                <FilaInfo etiqueta="Grado" valor={movimiento.gradoNombre} />
                <FilaInfo etiqueta="Tipo de nómina" valor={movimiento.tipoNominaNombre} />
                <FilaInfo etiqueta="Tipo de personal" valor={movimiento.tipoPersonalNombre} />
                <FilaInfo etiqueta="Estatus" valor={movimiento.estatusNombre} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Building2 className="size-4" aria-hidden="true" />
                  Estructura organizacional
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FilaInfo etiqueta="Dependencia" valor={movimiento.dependenciaNombre} />
                <FilaInfo etiqueta="Dirección general" valor={movimiento.direccionGeneralNombre} />
                <FilaInfo etiqueta="Dirección de línea" valor={movimiento.direccionLineaNombre} />
                <FilaInfo etiqueta="Coordinación" valor={movimiento.coordinacionNombre} />
              </CardContent>
            </Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
