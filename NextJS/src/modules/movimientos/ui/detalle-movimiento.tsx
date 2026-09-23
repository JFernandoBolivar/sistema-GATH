"use client";

/**
 * Vista de detalle (solo lectura) de un movimiento de cargo.
 * Paridad con el sistema de referencia (`tableMoves/detail-info.tsx`):
 * Sheet deslizable con Información General, Cargo, y Estructura Organizacional.
 */
import { Briefcase, Building2, FileText } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";

import { Badge } from "@/shared/ui/components/badge";
import { Card, CardContent, CardHeader } from "@/shared/ui/components/card";
import { ScrollArea } from "@/shared/ui/components/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/components/sheet";

import type { MovimientoCargoDTO } from "../application/dtos/movimientos-dto";

function formatFechaHora(fecha: string | null | undefined): string {
  if (!fecha) return "N/A";
  try {
    return formatInTimeZone(fecha, "UTC", "dd/MM/yyyy HH:mm");
  } catch {
    return fecha;
  }
}

interface DetalleMovimientoProps {
  movimiento: MovimientoCargoDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetalleMovimiento({ movimiento, open, onOpenChange }: DetalleMovimientoProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Detalles del Movimiento de Cargo</SheetTitle>
        </SheetHeader>

        {movimiento && (
          <ScrollArea className="h-[90%] pr-4">
            <div className="flex flex-col gap-5 mt-6">
              {/* Información General */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <FileText className="size-4 text-primary" />
                  <span className="font-semibold text-sm">Información General</span>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <span className="text-muted-foreground">Código de Puesto</span>
                    <span className="font-medium">{movimiento.codigoPuesto}</span>

                    <span className="text-muted-foreground">Cédula del Empleado</span>
                    <span className="font-medium">{movimiento.empleadoCedula}</span>

                    <span className="text-muted-foreground">Fecha del Movimiento</span>
                    <span>{formatFechaHora(movimiento.fechaMovimiento)}</span>

                    <span className="text-muted-foreground">Tipo de Movimiento</span>
                    <Badge className="w-fit bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                      {movimiento.tipoMovimiento || "N/A"}
                    </Badge>

                    <span className="text-muted-foreground">Motivo</span>
                    <span>{movimiento.motivoNombre || "N/A"}</span>

                    <span className="text-muted-foreground">Modificado Por</span>
                    <span>{movimiento.ejecutadoPorNombre || "N/A"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Cargo Resultante */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <Briefcase className="size-4 text-primary" />
                  <span className="font-semibold text-sm">Cargo</span>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <span className="text-muted-foreground">Denominación de Cargo</span>
                    <span>{movimiento.denominacionNombre || "N/A"}</span>

                    <span className="text-muted-foreground">Cargo Específico</span>
                    <span>{movimiento.especificaNombre || "N/A"}</span>

                    <span className="text-muted-foreground">Grado</span>
                    <span>{movimiento.gradoNombre || "N/A"}</span>

                    <span className="text-muted-foreground">Tipo de Nómina</span>
                    <span>{movimiento.tipoNominaNombre || "N/A"}</span>

                    <span className="text-muted-foreground">Tipo de Personal</span>
                    <span>{movimiento.tipoPersonalNombre || "N/A"}</span>

                    <span className="text-muted-foreground">Estatus</span>
                    <span>{movimiento.estatusNombre || "N/A"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Estructura Organizacional */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <Building2 className="size-4 text-primary" />
                  <span className="font-semibold text-sm">Estructura Organizacional</span>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <span className="text-muted-foreground">Dependencia</span>
                    <span>{movimiento.dependenciaNombre || "N/A"}</span>

                    <span className="text-muted-foreground">Dirección General</span>
                    <span>{movimiento.direccionGeneralNombre || "N/A"}</span>

                    <span className="text-muted-foreground">División / Dirección de Línea</span>
                    <span>{movimiento.direccionLineaNombre || "N/A"}</span>

                    <span className="text-muted-foreground">Coordinación</span>
                    <span>{movimiento.coordinacionNombre || "N/A"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
