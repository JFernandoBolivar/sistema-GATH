"use client";

import { EmployeeCargoHistory } from "@/app/types/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Briefcase, Building2, FileText } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";

interface DetailInfoMovesProps {
  movement: EmployeeCargoHistory;
}

export function DetailInfoMoves({ movement }: DetailInfoMovesProps) {
  const ComparisonField = ({
    label,
    prevValue,
    newValue,
  }: {
    label: string;
    prevValue: string | null;
    newValue: string | null;
  }) => {
    const hasChanged = prevValue !== newValue;

    return (
      <>
        <span className="text-sm font-medium">{label}</span>
        <div className="col-span-1 space-y-2">
          <div className="text-xs text-muted-foreground">Anterior:</div>
          <div className="text-sm bg-red-50 dark:bg-red-950 p-2 rounded border border-red-200 dark:border-red-800">
            {prevValue || (
              <span className="text-muted-foreground italic">N/A</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2">Nuevo:</div>
          <div
            className={`text-sm p-2 rounded border ${
              hasChanged
                ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800"
            }`}
          >
            {newValue || (
              <span className="text-muted-foreground italic">N/A</span>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" className="w-full">
          Ver detalles
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Detalles del Movimiento de Cargo</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[90%] pr-4">
          <div className="space-y-5 mt-6">
            {/* Información General */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Información General</span>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <span>Código de Puesto</span>
                  <span>{movement.codigo_puesto}</span>
                  <span>Fecha del Movimiento</span>
                  <span>
                    {formatInTimeZone(
                      movement.fecha_movimiento,
                      "UTC",
                      "dd/MM/yyyy HH:mm",
                    )}
                  </span>
                  <span>Tipo de Movimiento</span>
                  <Badge className="w-fit bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                    {movement.motivo_movimiento?.movimiento || "N/A"}
                  </Badge>
                  <span>Modificado Por</span>
                  <span>{movement.modificado_por_usuario || "N/A"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cambios de Cargo */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span>Cambios de Cargo</span>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6">
                  <div className="grid  gap-4">
                    <ComparisonField
                      label="Denominación de Cargo"
                      prevValue={movement.prev_denominacioncargo?.cargo || null}
                      newValue={movement.new_denominacioncargo?.cargo || null}
                    />
                  </div>
                  <div className="grid  gap-4">
                    <ComparisonField
                      label="Cargo Específico"
                      prevValue={
                        movement.prev_denominacioncargoespecifico?.cargo || null
                      }
                      newValue={
                        movement.new_denominacioncargoespecifico?.cargo || null
                      }
                    />
                  </div>
                  <div className="grid  gap-4">
                    <ComparisonField
                      label="Grado"
                      prevValue={movement.prev_grado?.grado || null}
                      newValue={movement.new_grado?.grado || null}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cambios de Estructura Organizacional */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Estructura Organizacional</span>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6">
                  <div className="grid  gap-4">
                    <ComparisonField
                      label="D / G / O"
                      prevValue={
                        movement.prev_DireccionGeneral?.direccion_general ||
                        null
                      }
                      newValue={
                        movement.new_DireccionGeneral?.direccion_general || null
                      }
                    />
                  </div>
                  <div className="grid  gap-4">
                    <ComparisonField
                      label="División / Coordinación"
                      prevValue={
                        movement.prev_DireccionLinea?.direccion_linea || null
                      }
                      newValue={
                        movement.new_DireccionLinea?.direccion_linea || null
                      }
                    />
                  </div>
                  <div className="grid  gap-4">
                    <ComparisonField
                      label="Coordinación"
                      prevValue={
                        movement.prev_Coordinacion?.coordinacion || null
                      }
                      newValue={movement.new_Coordinacion?.coordinacion || null}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cambios de Nómina y Estatus */}
            <Card>
              <CardHeader>Nómina y Estatus</CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6">
                  <div className="grid  gap-4">
                    <ComparisonField
                      label="Tipo de Nómina"
                      prevValue={movement.prev_tiponomina?.nomina || null}
                      newValue={movement.new_tiponomina?.nomina || null}
                    />
                  </div>
                  <div className="grid  gap-4">
                    <ComparisonField
                      label="Estatus"
                      prevValue={movement.prev_estatus?.estatus || null}
                      newValue={movement.new_estatus?.estatus || null}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
