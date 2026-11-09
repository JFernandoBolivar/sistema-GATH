"use client";

/**
 * Definición de columnas del listado de carnets emitidos para `DataTable`
 * (tanstack). El legado (`carnetizacion/`) no tiene un listado tanstack
 * equivalente para esta pestaña (usa tarjetas en `buscar/` y `estadisticas/`,
 * ver PLAN_RECONSTRUCCION_UI_2026-09-15.md sección "carnetización") — se
 * aplica igualmente el patrón `DataTable`+menú de acciones ya establecido en
 * `personal` para mantener consistencia entre módulos, consolidando los
 * botones sueltos (Diseñador/PDF/Validar/Revocar) en un menú desplegable.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Copy, FileDown, MoreHorizontal, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";

import type { CarnetDTO } from "../application/dtos/carnet-dto";

export interface OpcionesColumnasCarnet {
  puedeDisenar?: boolean;
  puedeDescargar?: boolean;
  puedeRevocar?: boolean;
}

function AccionesCell({
  carnet,
  onAbrirDisenador,
  onDescargarPdf,
  onValidar,
  onRevocar,
  puedeDisenar = true,
  puedeDescargar = true,
  puedeRevocar = true,
}: {
  carnet: CarnetDTO;
  onAbrirDisenador: (cedula: string) => void;
  onDescargarPdf: (carnetId: number) => void;
  onValidar: (cedula: string) => void;
  onRevocar: (carnetId: number) => void;
  puedeDisenar?: boolean;
  puedeDescargar?: boolean;
  puedeRevocar?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-8 p-0">
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(carnet.empleadoCedula)}>
          <Copy className="size-4" aria-hidden="true" /> Copiar cédula
        </DropdownMenuItem>
        {puedeDisenar && (
          <DropdownMenuItem onClick={() => onAbrirDisenador(carnet.empleadoCedula)}>
            <Sparkles className="size-4 text-amber-500" aria-hidden="true" /> Abrir en Diseñador
          </DropdownMenuItem>
        )}
        {puedeDescargar && (
          <DropdownMenuItem onClick={() => onDescargarPdf(carnet.id)}>
            <FileDown className="size-4" aria-hidden="true" /> Descargar PDF
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onValidar(carnet.empleadoCedula)}>
          <ShieldCheck className="size-4" aria-hidden="true" /> Validar
        </DropdownMenuItem>
        {carnet.activo && puedeRevocar && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onRevocar(carnet.id)}>
              <Ban className="size-4" aria-hidden="true" /> Revocar carnet
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasCarnets(
  onAbrirDisenador: (cedula: string) => void,
  onDescargarPdf: (carnetId: number) => void,
  onValidar: (cedula: string) => void,
  onRevocar: (carnetId: number) => void,
  opciones: OpcionesColumnasCarnet = {},
): ColumnDef<CarnetDTO>[] {
  return [
    {
      accessorKey: "empleadoCedula",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ row }) => <span className="font-medium">{row.original.empleadoCedula}</span>,
    },
    {
      id: "empleado",
      header: "Empleado",
      cell: ({ row }) => <span>{row.original.empleadoNombres} {row.original.empleadoApellidos}</span>,
    },
    { accessorKey: "motivoNombre", header: "Motivo" },
    {
      accessorKey: "fechaEmision",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Emisión" />,
    },
    {
      accessorKey: "activo",
      header: "Estado",
      cell: ({ getValue }) => (
        <Badge variant={getValue() ? "default" : "outline"}>{getValue() ? "Activo" : "Revocado"}</Badge>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          carnet={row.original}
          onAbrirDisenador={onAbrirDisenador}
          onDescargarPdf={onDescargarPdf}
          onValidar={onValidar}
          onRevocar={onRevocar}
          puedeDisenar={opciones.puedeDisenar}
          puedeDescargar={opciones.puedeDescargar}
          puedeRevocar={opciones.puedeRevocar}
        />
      ),
    },
  ];
}
