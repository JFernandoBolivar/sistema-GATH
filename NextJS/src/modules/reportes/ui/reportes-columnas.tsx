"use client";

/**
 * Definiciones de columnas de los listados de reportes para `DataTable`
 * (tanstack). El legado fragmenta reportes en rutas propias por tipo
 * (empleados/egresados/códigos/familiares bajo gestion-trabajadores/reportes/,
 * pasivos bajo gestion-pasivos/reportes/), cada una con su propio
 * `tableXReport/{columns,data-table,data-table-column-header}.tsx` — réplica
 * exacta del patrón de `personal` (columnas ordenables + menú de acciones con
 * "Copiar cédula"/"Ver Detalles" en Sheet). Por decisión del coordinador se
 * mantiene la página única consolidada (ver PLAN_RECONSTRUCCION_UI_2026-09-15.md),
 * pero se aplica igual `DataTable`+dropdown en vez de tabla HTML plana; el
 * "Ver Detalles" del legado no se replica (implicaría un Sheet propio por
 * cada uno de los 6 tipos) — el detalle completo ya está cubierto por la
 * exportación PDF/Excel existente por tab.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, MoreHorizontal } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";

import type {
  ReporteItemCodigoDTO,
  ReporteItemFamiliarDTO,
  ReporteItemPasivoDTO,
  ReporteItemPersonalDTO,
  ReporteItemVacanteDTO,
} from "../application/dtos/reporte-dto";

function CopiarCell({ valor, label }: { valor: string; label: string }) {
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
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(valor)}>
          <Copy className="size-4" aria-hidden="true" /> {label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasReportePersonal(): ColumnDef<ReporteItemPersonalDTO>[] {
  return [
    {
      accessorKey: "cedula",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ row }) => <span className="font-medium">{row.original.cedula}</span>,
    },
    { accessorKey: "nombreCompleto", header: "Nombre" },
    { accessorKey: "dependencia", header: "Dependencia" },
    { accessorKey: "cargo", header: "Cargo" },
    { accessorKey: "tipoPersonal", header: "Tipo" },
    {
      accessorKey: "fechaIngreso",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Ingreso" />,
    },
    { accessorKey: "totalAnosApn", header: "APN (años)" },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <CopiarCell valor={row.original.cedula} label="Copiar cédula" />,
    },
  ];
}

export function construirColumnasReportePasivos(): ColumnDef<ReporteItemPasivoDTO>[] {
  return [
    {
      accessorKey: "cedula",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ row }) => <span className="font-medium">{row.original.cedula}</span>,
    },
    { accessorKey: "nombreCompleto", header: "Nombre" },
    { accessorKey: "tipoPersonal", header: "Tipo" },
    {
      accessorKey: "fechaEgreso",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Egreso" />,
    },
    { accessorKey: "motivoEgreso", header: "Motivo" },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <CopiarCell valor={row.original.cedula} label="Copiar cédula" />,
    },
  ];
}

export function construirColumnasReporteVacantes(): ColumnDef<ReporteItemVacanteDTO>[] {
  return [
    {
      accessorKey: "codigoNomina",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
      cell: ({ getValue }) => <span className="font-medium">{(getValue() as string | null) ?? "—"}</span>,
    },
    { accessorKey: "denominacionCargo", header: "Denominación" },
    { accessorKey: "dependencia", header: "Dependencia" },
    { accessorKey: "direccionGeneral", header: "Dirección general" },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <CopiarCell valor={row.original.codigoNomina ?? ""} label="Copiar código" />,
    },
  ];
}

export function construirColumnasReporteFamiliares(): ColumnDef<ReporteItemFamiliarDTO>[] {
  return [
    {
      accessorKey: "cedulaFamiliar",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula familiar" />,
      cell: ({ row }) => <span className="font-medium">{row.original.cedulaFamiliar}</span>,
    },
    {
      id: "nombre",
      header: "Nombre",
      cell: ({ row }) => <span>{row.original.nombres} {row.original.apellidos}</span>,
    },
    { accessorKey: "parentesco", header: "Parentesco" },
    { accessorKey: "sexo", header: "Sexo" },
    {
      accessorKey: "fechaNacimiento",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Nacimiento" />,
    },
    { accessorKey: "cedulaEmpleado", header: "Cédula empleado" },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <CopiarCell valor={row.original.cedulaEmpleado} label="Copiar cédula del empleado" />,
    },
  ];
}

export function construirColumnasReporteCodigos(): ColumnDef<ReporteItemCodigoDTO>[] {
  return [
    {
      accessorKey: "codigo",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
      cell: ({ row }) => <span className="font-medium">{row.original.codigo}</span>,
    },
    { accessorKey: "cargo", header: "Cargo" },
    { accessorKey: "cargoEspecifico", header: "Cargo específico" },
    { accessorKey: "tipoNomina", header: "Nómina" },
    { accessorKey: "dependencia", header: "Dependencia" },
    { accessorKey: "direccionGeneral", header: "Dirección general" },
    { accessorKey: "estatus", header: "Estatus" },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <CopiarCell valor={row.original.codigo} label="Copiar código" />,
    },
  ];
}
